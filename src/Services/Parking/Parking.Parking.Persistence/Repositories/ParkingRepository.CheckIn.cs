using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Npgsql;
using NpgsqlTypes;
using Parking.Parking.Application.DTOs;
using Parking.Parking.Application.Interfaces;
using Parking.Parking.Application.Features.Incidents;
using Parking.Parking.Domain;
using Parking.ServiceDefaults;

namespace Parking.Parking.Persistence.Repositories;

public sealed partial class ParkingRepository
{
    // QR, session, occupancy và audit cùng commit hoặc cùng rollback.
    /// <summary>Consume QR, tạo phiên và chỗ đỗ vật lý, đổi trạng thái booking, ghi audit và outcome trong cùng transaction; replay không tạo phiên mới.</summary>
    public async Task<CheckInResponseDto> CheckInAsync(Guid actorId, CheckInRequestDto request,
        ValidatedQrToken token, string key, CancellationToken ct)
    {
        if (actorId == Guid.Empty || request.LotId == Guid.Empty || request.GateId == Guid.Empty ||
            string.IsNullOrWhiteSpace(key) || key.Length > 128 ||
            !PlateNumber.TryNormalize(request.DetectedPlate, out var plate))
            throw new ServiceException(400, "Valid actor, lot, gate, plate and Idempotency-Key required.");
        if (token.LotId != request.LotId)
            throw new ServiceException(409, "QR does not belong to this parking lot.");

        await using var connection = await db.OpenConnectionAsync(ct);
        await using var transaction = await connection.BeginTransactionAsync(ct);
        var dedupeKey = $"CheckIn:{actorId}:{key}";
        var requestId = new Guid(SHA256.HashData(Encoding.UTF8.GetBytes(dedupeKey)).AsSpan(0, 16));
        var normalizedVehicleHint = string.IsNullOrWhiteSpace(request.VehicleType)
            ? null
            : request.VehicleType.Trim().ToUpperInvariant();
        var fingerprint = ComputeCheckInFingerprint(request, plate, normalizedVehicleHint);

        // Mỗi lệnh dùng chung connection/transaction và bộ IDs đã xác minh; không tự commit riêng.
        NpgsqlCommand Command(string sql)
        {
            var command = new NpgsqlCommand(sql, connection, transaction);
            command.Parameters.AddWithValue("booking", token.BookingId);
            command.Parameters.AddWithValue("vehicle", token.VehicleId);
            command.Parameters.AddWithValue("lot", request.LotId);
            command.Parameters.AddWithValue("gate", request.GateId);
            command.Parameters.AddWithValue("actor", actorId);
            command.Parameters.AddWithValue("nonce", token.NonceHash);
            return command;
        }

        // Khóa key cho retry; tiếp theo VEHICLE -> SLOT giống luồng payment/expiry.
        await using (var claim = Command("SELECT pg_advisory_xact_lock(hashtextextended(@key,0))"))
        {
            claim.Parameters.AddWithValue("key", dedupeKey);
            await claim.ExecuteNonQueryAsync(ct);
        }
        await using (var replay = Command("SELECT payload_hash,outcome FROM integration_inbox WHERE event_id=@id AND event_type='CheckInRequest'"))
        {
            replay.Parameters.AddWithValue("id", requestId);
            await using var reader = await replay.ExecuteReaderAsync(ct);
            if (await reader.ReadAsync(ct))
            {
                if (reader.GetString(0) != fingerprint)
                    throw new ServiceException(409, "Idempotency key reused for a different check-in request.");
                return JsonSerializer.Deserialize<CheckInResponseDto>(reader.GetString(1))!;
            }
        }
        await using (var vehicleLock = Command("SELECT lock_parking_resource('VEHICLE',@vehicle)"))
            await vehicleLock.ExecuteNonQueryAsync(ct);

        // Tìm reservation đã xác nhận rồi khóa slot trước khi kiểm tra điều kiện xe vào.
        Guid slotId;
        await using (var locate = Command("""
            SELECT r.slot_id FROM bookings b JOIN slot_reservations r ON r.booking_id=b.id
            WHERE b.id=@booking AND b.lot_id=@lot AND b.vehicle_id=@vehicle
              AND b.status='CONFIRMED' AND r.status='CONFIRMED'
            """))
        {
            if (await locate.ExecuteScalarAsync(ct) is not Guid found)
                throw new ServiceException(409, "Booking is not confirmed or has already checked in.");
            slotId = found;
        }
        await using (var slotLock = Command("SELECT lock_parking_resource('SLOT',@slot)"))
        {
            slotLock.Parameters.AddWithValue("slot", slotId);
            await slotLock.ExecuteNonQueryAsync(ct);
        }

        Guid snapshotId;
        string vehicleType;
        string bookedPlate;
        string normalizedVehiclePlate;
        DateTimeOffset startsAt;
        DateTimeOffset endsAt;
        DateTimeOffset arrivalDeadline;
        int earlyMinutes;
        string timezone;
        DateTimeOffset entryAt;
        string slotCode;
        string levelName;
        await using (var validate = Command("""
            SELECT b.pricing_snapshot_id,b.vehicle_type,b.plate_snapshot,v.plate_normalized,
              b.starts_at,b.ends_at,b.arrival_deadline,p.early_arrival_minutes,l.timezone,clock_timestamp(),s.code,lvl.name
            FROM bookings b JOIN slot_reservations r ON r.booking_id=b.id
            JOIN parking_slots s ON s.id=r.slot_id AND s.lot_id=b.lot_id
            JOIN parking_levels lvl ON lvl.id=s.level_id AND lvl.lot_id=s.lot_id
            JOIN parking_lots l ON l.id=b.lot_id
            JOIN vehicles v ON v.id=b.vehicle_id
            JOIN lot_vehicle_policies p ON p.lot_id=b.lot_id AND p.vehicle_type=b.vehicle_type
            WHERE b.id=@booking AND b.lot_id=@lot AND b.vehicle_id=@vehicle
              AND b.status='CONFIRMED' AND r.status='CONFIRMED' AND r.slot_id=@slot
              AND s.operational_status='ACTIVE' AND l.status='ACTIVE' AND v.is_active
              AND EXISTS(SELECT 1 FROM lot_gates g WHERE g.id=@gate AND g.lot_id=@lot AND g.gate_kind IN ('ENTRY','BOTH'))
              AND NOT EXISTS(SELECT 1 FROM session_slot_assignments a WHERE a.slot_id=s.id AND a.vacated_at IS NULL)
              AND NOT EXISTS(SELECT 1 FROM parking_sessions ps WHERE ps.vehicle_id=b.vehicle_id AND ps.status IN ('ACTIVE','EXIT_PENDING'))
            FOR UPDATE OF b,r FOR SHARE OF s,l,v,p
            """))
        {
            validate.Parameters.AddWithValue("slot", slotId);
            await using var reader = await validate.ExecuteReaderAsync(ct);
            if (!await reader.ReadAsync(ct))
                throw new ServiceException(409, "Booking, entry gate, vehicle or physical slot is unavailable.");
            snapshotId = reader.GetGuid(0);
            vehicleType = reader.GetString(1);
            bookedPlate = reader.GetString(2);
            normalizedVehiclePlate = reader.GetString(3);
            startsAt = reader.GetFieldValue<DateTimeOffset>(4);
            endsAt = reader.GetFieldValue<DateTimeOffset>(5);
            arrivalDeadline = reader.GetFieldValue<DateTimeOffset>(6);
            earlyMinutes = reader.GetInt32(7);
            timezone = reader.GetString(8);
            entryAt = reader.GetFieldValue<DateTimeOffset>(9);
            slotCode = reader.GetString(10);
            levelName = reader.GetString(11);
        }

        // Đóng reader của validate trước khi ghi sự cố hoặc rollback transaction (tránh lỗi connection busy).
        var hasPlateMismatch = plate != bookedPlate || plate != normalizedVehiclePlate;
        string? overrideReason = null;
        if (hasPlateMismatch)
        {
            var expectedPlateLabel = bookedPlate == normalizedVehiclePlate
                ? bookedPlate
                : $"{bookedPlate}/{normalizedVehiclePlate}";
            var mismatchDescription = $"Observed plate {plate} does not match booked plate {expectedPlateLabel}.";

            if (!request.AllowMismatchOverride)
            {
                await transaction.RollbackAsync(ct);
                await RecordRejectedPlateMismatchIncidentAsync(
                    connection, request.LotId, token.BookingId, actorId, plate, slotCode,
                    $"Observed plate {plate} does not match booked plate {expectedPlateLabel}",
                    mismatchDescription, ct);
                throw new ServiceException(409, "Observed plate does not match the booked vehicle. Staff override required.", "PLATE_MISMATCH");
            }

            overrideReason = request.OverrideReason?.Trim();
            if (overrideReason is null || overrideReason.Length < 10 || overrideReason.Length > 500)
                throw new ServiceException(400, "Override reason must contain between 10 and 500 characters.");
            if (!IncidentEvidenceRules.HasCameraEvidence(request.Evidence))
                throw new ServiceException(400, "A safe camera image reference is required for plate mismatch override.");
            await ValidateStoredEvidenceAsync(connection, transaction, request.LotId, request.Evidence!, ct);
            var evidence = JsonSerializer.Serialize(request.Evidence, JsonOptions);
            var overrideIncidentId = Guid.NewGuid();
            await using var resolveInc = Command("""
                INSERT INTO parking_issues(
                    id, lot_id, booking_id, issue_type, status, reason, resolution,
                    reported_by, approved_by, title, severity, description,
                    detected_at, related_plate, related_slot_code, evidence, version, created_at, updated_at, resolved_at)
                VALUES(
                    @incidentId, @lot, @booking, 'INCIDENT_0482_PLATE_MISMATCH', 'Resolved',
                    @reason, @overrideReason, @actor, @actor,
                    'Lệch biển số khi check-in (Staff override)', 'High',
                    @description, clock_timestamp(), @plate, @slotCode, @evidence::jsonb, 1, clock_timestamp(), clock_timestamp(), clock_timestamp());
                INSERT INTO incident_history(
                    id, incident_id, lot_id, action, from_status, to_status, performed_by_user_id, reason, performed_at)
                VALUES(
                    gen_random_uuid(), @incidentId, @lot, 'CREATED_AND_RESOLVED', NULL, 'Resolved', @actor, @overrideReason, clock_timestamp());
                INSERT INTO outbox_events(id, lot_id, event_type, aggregate_id, payload, occurred_at, attempts)
                VALUES(gen_random_uuid(), @lot, 'parking.checkin.mismatch_override', @incidentId,
                    jsonb_build_object('incidentId', @incidentId, 'bookingId', @booking, 'lotId', @lot,
                        'actorId', @actor, 'observedPlate', @plate, 'bookedPlate', @bookedPlate::text,
                        'reason', @overrideReason::text, 'evidence', @evidence::jsonb), clock_timestamp(), 0);
                """);
            resolveInc.Parameters.AddWithValue("incidentId", overrideIncidentId);
            resolveInc.Parameters.AddWithValue("reason", $"Plate mismatch override: observed {plate} vs booked {expectedPlateLabel}");
            resolveInc.Parameters.AddWithValue("overrideReason", overrideReason);
            resolveInc.Parameters.AddWithValue("description", mismatchDescription);
            resolveInc.Parameters.AddWithValue("plate", plate);
            resolveInc.Parameters.AddWithValue("slotCode", slotCode);
            resolveInc.Parameters.AddWithValue("bookedPlate", bookedPlate);
            resolveInc.Parameters.AddWithValue("evidence", evidence);
            await resolveInc.ExecuteNonQueryAsync(ct);
        }

        if (entryAt < startsAt.AddMinutes(-earlyMinutes) || entryAt > arrivalDeadline || entryAt >= endsAt)
            throw new ServiceException(409, "Check-in is outside the allowed arrival window.");

        // Kiểm tra giờ hoạt động theo timezone riêng của bãi và closure hiện tại.
        var openingIntervals = new List<(int From, int To)>();
        await using (var opening = Command("SELECT start_minute,end_minute FROM lot_opening_intervals WHERE lot_id=@lot"))
        {
            await using var reader = await opening.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct)) openingIntervals.Add((reader.GetInt32(0), reader.GetInt32(1)));
        }
        TimeZoneInfo zone;
        try { zone = TimeZoneInfo.FindSystemTimeZoneById(timezone); }
        catch (Exception error) when (error is TimeZoneNotFoundException or InvalidTimeZoneException)
        { throw new ServiceException(503, "Lot timezone configuration is invalid."); }
        if (!LotOperatingHours.Covers(entryAt, entryAt.AddTicks(1), zone, openingIntervals))
            throw new ServiceException(409, "Parking lot is outside operating hours.");
        await using (var closure = Command("SELECT EXISTS(SELECT 1 FROM lot_closures WHERE lot_id=@lot AND starts_at<=clock_timestamp() AND ends_at>clock_timestamp())"))
            if ((bool)(await closure.ExecuteScalarAsync(ct))!)
                throw new ServiceException(409, "Parking lot is temporarily closed.");

        // UPDATE có điều kiện: QR hết hạn/thu hồi/đã dùng sẽ không consume được lần nữa.
        await using (var consume = Command("""
            UPDATE qr_tokens SET consumed_at=clock_timestamp()
            WHERE booking_id=@booking AND nonce_hash=@nonce AND consumed_at IS NULL AND revoked_at IS NULL
              AND expires_at>clock_timestamp() AND expires_at=@expiry
              AND EXISTS(SELECT 1 FROM bookings WHERE id=@booking AND status='CONFIRMED'
                AND arrival_deadline>=clock_timestamp() AND ends_at>clock_timestamp())
            """))
        {
            consume.Parameters.AddWithValue("expiry", token.ExpiresAt.UtcDateTime);
            if (await consume.ExecuteNonQueryAsync(ct) != 1)
                throw new ServiceException(409, "QR is expired, revoked, already used or no longer valid.");
        }

        // Chuyển reservation sang physical assignment: slot vẫn OCCUPIED khi xe còn ở bãi.
        var sessionId = Guid.NewGuid();
        var slotChangedEventId = Guid.NewGuid();
        await using (var write = Command("""
            INSERT INTO parking_sessions(id,lot_id,vehicle_id,vehicle_type,booking_id,pricing_snapshot_id,
              plate_snapshot,entry_gate_id,entry_at,expected_exit_at,status,entry_method,entered_by)
            VALUES(@session,@lot,@vehicle,@type,@booking,@snapshot,@plate,@gate,@entry,@end,'ACTIVE','QR',@actor);
            INSERT INTO session_slot_assignments(id,session_id,lot_id,slot_id,vehicle_type,occupied_from,assigned_by,reason)
            VALUES(gen_random_uuid(),@session,@lot,@slot,@type,@entry,@actor,'QR_CHECK_IN');
            UPDATE bookings SET status='CHECKED_IN',version=version+1 WHERE id=@booking;
            UPDATE slot_reservations SET status='RELEASED',released_at=@entry,release_reason='CHECKED_IN'
              WHERE booking_id=@booking AND status='CONFIRMED';
            UPDATE qr_tokens SET revoked_at=@entry WHERE booking_id=@booking AND consumed_at IS NULL AND revoked_at IS NULL;
            INSERT INTO audit_logs(id,lot_id,actor_user_id,actor_type,action,entity_type,entity_id,request_id,new_values,created_at)
            VALUES(gen_random_uuid(),@lot,@actor,'STAFF','CHECK_IN','PARKING_SESSION',@entity,@request,
              jsonb_strip_nulls(jsonb_build_object(
                'bookingId',@booking,
                'slotId',@slot,
                'slotCode',@slotCode,
                'status','ACTIVE',
                'plateMismatchOverride',@mismatchOverride,
                'bookedPlate',@bookedPlate::text,
                'overrideReason',@overrideReason::text
              )),@entry);
            INSERT INTO outbox_events(id,lot_id,event_type,aggregate_id,payload,occurred_at,attempts)
            VALUES(gen_random_uuid(),@lot,'CheckInSucceeded',@session,
              jsonb_build_object(
                'sessionId',@session,
                'bookingId',@booking,
                'lotId',@lot,
                'slotId',@slot,
                'slotCode',@slotCode,
                'gateId',@gate,
                'plate',@plate,
                'vehicleType',@type,
                'entryMethod','QR',
                'status','ACTIVE',
                'entryAt',@entry,
                'barrierAction','OPEN'
              ),@entry,0);
            INSERT INTO integration_outbox(event_id,event_type,aggregate_id,payload,occurred_at)
            VALUES(@slotChangedId,'SlotStatusChanged.v1',@slot,@slotChangedPayload::jsonb,@entry);
            """))
        {
            write.Parameters.AddWithValue("session", sessionId);
            write.Parameters.AddWithValue("type", vehicleType);
            write.Parameters.AddWithValue("snapshot", snapshotId);
            write.Parameters.AddWithValue("plate", plate);
            write.Parameters.AddWithValue("slot", slotId);
            write.Parameters.AddWithValue("slotCode", slotCode);
            write.Parameters.AddWithValue("entry", entryAt.UtcDateTime);
            write.Parameters.AddWithValue("end", endsAt.UtcDateTime);
            write.Parameters.AddWithValue("entity", sessionId.ToString());
            write.Parameters.AddWithValue("request", requestId.ToString());
            write.Parameters.AddWithValue("mismatchOverride", hasPlateMismatch);
            write.Parameters.Add("bookedPlate", NpgsqlDbType.Text).Value = hasPlateMismatch ? bookedPlate : DBNull.Value;
            write.Parameters.Add("overrideReason", NpgsqlDbType.Text).Value = (object?)overrideReason ?? DBNull.Value;
            write.Parameters.AddWithValue("slotChangedId", slotChangedEventId);
            write.Parameters.AddWithValue("slotChangedPayload", BuildSlotOccupiedEventPayload(slotChangedEventId, request.LotId, slotId, entryAt));
            await write.ExecuteNonQueryAsync(ct);
        }
        var response = new CheckInResponseDto(sessionId, token.BookingId, request.LotId, slotId, "ACTIVE", entryAt, slotCode, vehicleType, "QR", levelName);
        await using (var outcome = Command("INSERT INTO integration_inbox(event_id,event_type,payload_hash,outcome) VALUES(@id,'CheckInRequest',@hash,@outcome)"))
        {
            outcome.Parameters.AddWithValue("id", requestId);
            outcome.Parameters.AddWithValue("hash", fingerprint);
            outcome.Parameters.AddWithValue("outcome", JsonSerializer.Serialize(response));
            await outcome.ExecuteNonQueryAsync(ct);
        }
        await transaction.CommitAsync(ct);
        return response;
    }

    /// <summary>
    /// SCRUM-69: Check-in tự động cho khách vãng lai (WALK_IN):
    /// Tự động đăng ký xe nếu mới, cấp ô đỗ tối ưu bằng thuật toán AUTO_SLOT (FOR UPDATE SKIP LOCKED),
    /// khởi tạo ParkingSession mới và gán slot vật lý trong cùng một transaction.
    /// </summary>
    public async Task<CheckInResponseDto> CheckInWalkInAsync(Guid actorId, CheckInRequestDto request, string key, CancellationToken ct)
    {
        if (actorId == Guid.Empty || request.LotId == Guid.Empty || request.GateId == Guid.Empty ||
            string.IsNullOrWhiteSpace(key) || key.Trim().Length > 128 ||
            !PlateNumber.TryNormalize(request.DetectedPlate, out var plate))
            throw new ServiceException(400, "Valid actor, lot, gate, plate and Idempotency-Key required.");

        key = key.Trim();
        var vehicleType = string.IsNullOrWhiteSpace(request.VehicleType)
            ? "CAR"
            : request.VehicleType.Trim().ToUpperInvariant();
        if (vehicleType is not ("CAR" or "MOTORBIKE"))
            throw new ServiceException(400, "VehicleType must be CAR or MOTORBIKE.");

        await using var connection = await db.OpenConnectionAsync(ct);
        await using var transaction = await connection.BeginTransactionAsync(ct);
        var dedupeKey = $"CheckInWalkIn:{actorId}:{key}";
        var requestId = new Guid(SHA256.HashData(Encoding.UTF8.GetBytes(dedupeKey)).AsSpan(0, 16));
        var fingerprint = ComputeCheckInFingerprint(request, plate, vehicleType);

        NpgsqlCommand Command(string sql)
        {
            var command = new NpgsqlCommand(sql, connection, transaction);
            command.Parameters.AddWithValue("lot", request.LotId);
            command.Parameters.AddWithValue("gate", request.GateId);
            command.Parameters.AddWithValue("actor", actorId);
            command.Parameters.AddWithValue("plate", plate);
            command.Parameters.AddWithValue("type", vehicleType);
            return command;
        }

        // 1. Khóa Idempotency Key
        await using (var claim = Command("SELECT pg_advisory_xact_lock(hashtextextended(@key,0))"))
        {
            claim.Parameters.AddWithValue("key", dedupeKey);
            await claim.ExecuteNonQueryAsync(ct);
        }

        // 2. Kiểm tra Replay trong integration_inbox
        await using (var replay = Command("SELECT payload_hash,outcome FROM integration_inbox WHERE event_id=@id AND event_type='CheckInWalkInRequest'"))
        {
            replay.Parameters.AddWithValue("id", requestId);
            await using var reader = await replay.ExecuteReaderAsync(ct);
            if (await reader.ReadAsync(ct))
            {
                if (reader.GetString(0) != fingerprint)
                    throw new ServiceException(409, "Idempotency key reused for a different walk-in check-in request.");
                return JsonSerializer.Deserialize<CheckInResponseDto>(reader.GetString(1))!;
            }
        }

        // 3. Kiểm tra trạng thái bãi đỗ, cổng vào và giờ mở cửa
        string timezone;
        DateTimeOffset entryAt;
        await using (var validateLot = Command("""
            SELECT l.timezone, clock_timestamp()
            FROM parking_lots l
            WHERE l.id=@lot AND l.status='ACTIVE'
              AND EXISTS(SELECT 1 FROM lot_gates g WHERE g.id=@gate AND g.lot_id=@lot AND g.gate_kind IN ('ENTRY','BOTH'))
            """))
        {
            await using var reader = await validateLot.ExecuteReaderAsync(ct);
            if (!await reader.ReadAsync(ct))
                throw new ServiceException(409, "Parking lot is inactive or entry gate is invalid.");
            timezone = reader.GetString(0);
            entryAt = reader.GetFieldValue<DateTimeOffset>(1);
        }

        // Giờ hoạt động và closure
        var openingIntervals = new List<(int From, int To)>();
        await using (var opening = Command("SELECT start_minute,end_minute FROM lot_opening_intervals WHERE lot_id=@lot"))
        {
            await using var reader = await opening.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct)) openingIntervals.Add((reader.GetInt32(0), reader.GetInt32(1)));
        }
        TimeZoneInfo zone;
        try { zone = TimeZoneInfo.FindSystemTimeZoneById(timezone); }
        catch (Exception error) when (error is TimeZoneNotFoundException or InvalidTimeZoneException)
        { throw new ServiceException(503, "Lot timezone configuration is invalid."); }
        if (!LotOperatingHours.Covers(entryAt, entryAt.AddTicks(1), zone, openingIntervals))
            throw new ServiceException(409, "Parking lot is outside operating hours.");
        await using (var closure = Command("SELECT EXISTS(SELECT 1 FROM lot_closures WHERE lot_id=@lot AND starts_at<=clock_timestamp() AND ends_at>clock_timestamp())"))
            if ((bool)(await closure.ExecuteScalarAsync(ct))!)
                throw new ServiceException(409, "Parking lot is temporarily closed.");

        // 4. Kiểm tra chính sách xe và dung lượng (Policy)
        int maxBookingMinutes;
        decimal admissionPercent;
        int reservedCapacity;
        int holdMinutes;
        int lateArrivalMinutes;
        await using (var policyCheck = Command("""
            SELECT p.max_booking_minutes, p.admission_percent, p.reserved_capacity, p.hold_minutes, p.late_arrival_minutes
            FROM lot_vehicle_policies p
            WHERE p.lot_id=@lot AND p.vehicle_type=@type
            """))
        {
            await using var reader = await policyCheck.ExecuteReaderAsync(ct);
            if (!await reader.ReadAsync(ct))
                throw new ServiceException(409, $"Vehicle type {vehicleType} is not supported at this parking lot.");
            maxBookingMinutes = reader.GetInt32(0);
            admissionPercent = reader.GetDecimal(1);
            reservedCapacity = reader.GetInt32(2);
            holdMinutes = reader.GetInt32(3);
            lateArrivalMinutes = reader.GetInt32(4);
        }

        var endsAt = entryAt.AddMinutes(maxBookingMinutes > 0 ? maxBookingMinutes : 1440);

        await using (var capacityCheck = Command("""
            SELECT
                COUNT(*)::int AS total_slots,
                COUNT(*) FILTER (WHERE EXISTS (
                    SELECT 1 FROM session_slot_assignments a
                    WHERE a.slot_id = s.id AND a.vacated_at IS NULL
                ))::int AS occupied_slots,
                COUNT(*) FILTER (WHERE
                    NOT EXISTS (
                        SELECT 1 FROM session_slot_assignments a
                        WHERE a.slot_id = s.id AND a.vacated_at IS NULL
                    )
                    AND NOT EXISTS (
                        SELECT 1 FROM slot_reservations sr
                        JOIN bookings b ON b.id = sr.booking_id
                        WHERE sr.slot_id = s.id
                          AND (
                              sr.status = 'CONFIRMED'
                              OR (sr.status = 'HELD' AND b.status = 'PENDING_PAYMENT' AND b.hold_expires_at > clock_timestamp())
                          )
                          AND tstzrange(sr.starts_at, sr.ends_at, '[)') && tstzrange(@entry, @end, '[)')
                    )
                )::int AS free_unreserved_slots
            FROM parking_slots s
            JOIN slot_vehicle_types svt ON svt.slot_id = s.id AND svt.lot_id = s.lot_id
            WHERE s.lot_id = @lot
              AND s.operational_status = 'ACTIVE'
              AND svt.vehicle_type = @type;
            """))
        {
            capacityCheck.Parameters.AddWithValue("entry", entryAt.UtcDateTime);
            capacityCheck.Parameters.AddWithValue("end", endsAt.UtcDateTime);
            await using var reader = await capacityCheck.ExecuteReaderAsync(ct);
            if (await reader.ReadAsync(ct))
            {
                var totalSlots = reader.GetInt32(0);
                var occupiedSlots = reader.GetInt32(1);
                var freeUnreservedSlots = reader.GetInt32(2);
                if (totalSlots == 0 || freeUnreservedSlots <= reservedCapacity ||
                    (admissionPercent < 100m && (occupiedSlots + 1) * 100m > totalSlots * admissionPercent))
                {
                    throw new ServiceException(409, "No available walk-in capacity for this vehicle type at this parking lot.");
                }
            }
        }

        // 5. Đăng ký xe tự động vào bảng vehicles nếu chưa có & đối soát vehicle_type & Khóa VEHICLE
        Guid vehicleId;
        string storedVehicleType;
        await using (var ensureVehicle = Command("""
            INSERT INTO vehicles (id, plate_country, plate_normalized, vehicle_type, fuel_type, is_active)
            VALUES (gen_random_uuid(), 'VN', @plate, @type, 'GASOLINE', true)
            ON CONFLICT (plate_country, plate_normalized) DO UPDATE SET is_active=true
            RETURNING id, vehicle_type;
            """))
        {
            await using var reader = await ensureVehicle.ExecuteReaderAsync(ct);
            await reader.ReadAsync(ct);
            vehicleId = reader.GetGuid(0);
            storedVehicleType = reader.GetString(1);
        }

        if (!string.Equals(storedVehicleType, vehicleType, StringComparison.OrdinalIgnoreCase))
            throw new ServiceException(409, $"Registered vehicle plate belongs to vehicle type {storedVehicleType}, not {vehicleType}.");

        await using (var vehicleLock = Command("SELECT lock_parking_resource('VEHICLE', @vehicle)"))
        {
            vehicleLock.Parameters.AddWithValue("vehicle", vehicleId);
            await vehicleLock.ExecuteNonQueryAsync(ct);
        }

        // 6. Kiểm tra Single Active Session (BR-12)
        await using (var activeCheck = Command("""
            SELECT EXISTS(
                SELECT 1 FROM parking_sessions ps
                WHERE ps.vehicle_id=@vehicle AND ps.status IN ('ACTIVE','EXIT_PENDING')
            )
            """))
        {
            activeCheck.Parameters.AddWithValue("vehicle", vehicleId);
            if ((bool)(await activeCheck.ExecuteScalarAsync(ct))!)
                throw new ServiceException(409, "Vehicle already has an active parking session.");
        }

        // 7. Thuật toán AUTO_SLOT: Tìm và khóa ô đỗ tối ưu nhất (FOR UPDATE OF s SKIP LOCKED trên map PUBLISHED)
        Guid slotId;
        string slotCode;
        string levelName;
        await using (var slotSearch = Command("""
            WITH published_map AS (
                SELECT id
                FROM map_versions
                WHERE lot_id = @lot AND status = 'PUBLISHED'
                ORDER BY version_no DESC
                LIMIT 1
            )
            SELECT s.id, s.code, lvl.name
            FROM parking_slots s
            JOIN parking_levels lvl ON lvl.id = s.level_id AND lvl.lot_id = s.lot_id
            JOIN slot_vehicle_types svt ON svt.slot_id = s.id AND svt.lot_id = s.lot_id
            LEFT JOIN published_map pm ON TRUE
            LEFT JOIN map_objects mo_slot
              ON mo_slot.slot_id = s.id AND mo_slot.lot_id = s.lot_id AND mo_slot.map_version_id = pm.id
            LEFT JOIN map_objects mo_gate
              ON mo_gate.gate_id = @gate AND mo_gate.lot_id = s.lot_id AND mo_gate.map_version_id = pm.id
            WHERE s.lot_id = @lot
              AND s.operational_status = 'ACTIVE'
              AND svt.vehicle_type = @type
              AND NOT EXISTS (
                  SELECT 1 FROM session_slot_assignments a
                  WHERE a.slot_id = s.id AND a.vacated_at IS NULL
              )
              AND NOT EXISTS (
                  SELECT 1 FROM slot_reservations sr
                  JOIN bookings b ON b.id = sr.booking_id
                  WHERE sr.slot_id = s.id
                    AND (
                        sr.status = 'CONFIRMED'
                        OR (sr.status = 'HELD' AND b.status = 'PENDING_PAYMENT' AND b.hold_expires_at > clock_timestamp())
                    )
                    AND tstzrange(sr.starts_at, sr.ends_at, '[)') && tstzrange(@entry, @end, '[)')
              )
            ORDER BY
              COALESCE(SQRT(POWER(mo_slot.x - mo_gate.x, 2) + POWER(mo_slot.y - mo_gate.y, 2) + POWER(mo_slot.z - mo_gate.z, 2)), 99999) ASC,
              lvl.display_order ASC,
              s.code ASC
            LIMIT 1
            FOR UPDATE OF s SKIP LOCKED;
            """))
        {
            slotSearch.Parameters.AddWithValue("entry", entryAt.UtcDateTime);
            slotSearch.Parameters.AddWithValue("end", endsAt.UtcDateTime);
            await using var reader = await slotSearch.ExecuteReaderAsync(ct);
            if (!await reader.ReadAsync(ct))
                throw new ServiceException(409, "No available slots for this vehicle type at this parking lot.");
            slotId = reader.GetGuid(0);
            slotCode = reader.GetString(1);
            levelName = reader.GetString(2);
        }

        await using (var slotLock = Command("SELECT lock_parking_resource('SLOT', @slot)"))
        {
            slotLock.Parameters.AddWithValue("slot", slotId);
            await slotLock.ExecuteNonQueryAsync(ct);
        }

        // Xác nhận lại dưới khóa SLOT rằng chưa có session/reservation nào vừa chen vào trước khi lock SLOT.
        await using (var slotDoubleCheck = Command("""
            SELECT
                EXISTS (
                    SELECT 1 FROM session_slot_assignments a
                    WHERE a.slot_id = @slot AND a.vacated_at IS NULL
                )
                OR EXISTS (
                    SELECT 1 FROM slot_reservations sr
                    JOIN bookings b ON b.id = sr.booking_id
                    WHERE sr.slot_id = @slot
                      AND (
                          sr.status = 'CONFIRMED'
                          OR (sr.status = 'HELD' AND b.status = 'PENDING_PAYMENT' AND b.hold_expires_at > clock_timestamp())
                      )
                      AND tstzrange(sr.starts_at, sr.ends_at, '[)') && tstzrange(@entry, @end, '[)')
                );
            """))
        {
            slotDoubleCheck.Parameters.AddWithValue("slot", slotId);
            slotDoubleCheck.Parameters.AddWithValue("entry", entryAt.UtcDateTime);
            slotDoubleCheck.Parameters.AddWithValue("end", endsAt.UtcDateTime);
            if ((bool)(await slotDoubleCheck.ExecuteScalarAsync(ct))!)
                throw new ServiceException(409, "Selected slot is no longer available.");
        }

        // 8. Lấy Pricing Snapshot từ bảng giá PUBLISHED, hoặc tự tạo snapshot nếu plan PUBLISHED chưa có snapshot nào
        Guid snapshotId;
        await using (var snapshotQuery = Command("""
            SELECT ps.id
            FROM pricing_snapshots ps
            JOIN pricing_plans p ON p.id = ps.plan_id AND p.lot_id = ps.lot_id AND p.vehicle_type = ps.vehicle_type
            WHERE ps.lot_id = @lot AND ps.vehicle_type = @type
              AND p.status = 'PUBLISHED'
              AND p.effective_from <= @entry
              AND (p.effective_until IS NULL OR p.effective_until >= @entry)
            ORDER BY p.version_no DESC, ps.created_at DESC
            LIMIT 1;
            """))
        {
            snapshotQuery.Parameters.AddWithValue("entry", entryAt.UtcDateTime);
            var found = await snapshotQuery.ExecuteScalarAsync(ct);
            if (found is Guid existingSnap)
            {
                snapshotId = existingSnap;
            }
            else
            {
                Guid? planId = null;
                string? rulesJson = null;
                await using (var planQuery = Command("""
                    SELECT pp.id, pr.parameters::text
                    FROM pricing_plans pp
                    JOIN pricing_rules pr ON pr.plan_id = pp.id AND pr.rule_type = 'FLAT_BLOCK'
                    WHERE pp.lot_id = @lot AND pp.vehicle_type = @type
                      AND pp.status = 'PUBLISHED' AND pp.currency = 'VND'
                      AND pp.effective_from <= @entry
                      AND (pp.effective_until IS NULL OR pp.effective_until >= @entry)
                      AND NOT EXISTS (SELECT 1 FROM pricing_rules extra WHERE extra.plan_id = pp.id AND extra.id <> pr.id)
                    ORDER BY pp.version_no DESC
                    LIMIT 1;
                    """))
                {
                    planQuery.Parameters.AddWithValue("entry", entryAt.UtcDateTime);
                    await using var planReader = await planQuery.ExecuteReaderAsync(ct);
                    if (await planReader.ReadAsync(ct))
                    {
                        planId = planReader.GetGuid(0);
                        rulesJson = planReader.GetString(1);
                    }
                }

                if (planId is Guid activePlanId && rulesJson is not null)
                {
                    snapshotId = Guid.NewGuid();
                    await using var createSnapshot = Command("""
                        INSERT INTO pricing_snapshots(id, lot_id, plan_id, vehicle_type, engine_version, resolved_rules, policy_snapshot, currency, created_at)
                        VALUES(@snapshot, @lot, @plan, @type, 'block-v1', @rules::jsonb,
                               jsonb_build_object('holdMinutes', @hold, 'lateArrivalMinutes', @late), 'VND', @entry);
                        """);
                    createSnapshot.Parameters.AddWithValue("snapshot", snapshotId);
                    createSnapshot.Parameters.AddWithValue("plan", activePlanId);
                    createSnapshot.Parameters.AddWithValue("rules", rulesJson);
                    createSnapshot.Parameters.AddWithValue("hold", holdMinutes);
                    createSnapshot.Parameters.AddWithValue("late", lateArrivalMinutes);
                    createSnapshot.Parameters.AddWithValue("entry", entryAt.UtcDateTime);
                    await createSnapshot.ExecuteNonQueryAsync(ct);
                }
                else
                {
                    await using var fallbackQuery = Command("SELECT id FROM pricing_snapshots WHERE lot_id=@lot AND vehicle_type=@type ORDER BY created_at DESC LIMIT 1;");
                    if (await fallbackQuery.ExecuteScalarAsync(ct) is not Guid fallbackSnap)
                        throw new ServiceException(503, "Active pricing plan or snapshot not found for lot and vehicle type.");
                    snapshotId = fallbackSnap;
                }
            }
        }

        // 9. Tạo ParkingSession mới và gán Chỗ đỗ vật lý (session_slot_assignments)
        var sessionId = Guid.NewGuid();
        var slotChangedEventId = Guid.NewGuid();
        await using (var write = Command("""
            INSERT INTO parking_sessions(id, lot_id, vehicle_id, vehicle_type, booking_id, pricing_snapshot_id,
              plate_snapshot, entry_gate_id, entry_at, expected_exit_at, status, entry_method, entered_by)
            VALUES(@session, @lot, @vehicle, @type, NULL, @snapshot, @plate, @gate, @entry, @end, 'ACTIVE', 'WALK_IN', @actor);

            INSERT INTO session_slot_assignments(id, session_id, lot_id, slot_id, vehicle_type, occupied_from, assigned_by, reason)
            VALUES(gen_random_uuid(), @session, @lot, @slot, @type, @entry, @actor, 'WALK_IN_CHECK_IN');

            INSERT INTO audit_logs(id, lot_id, actor_user_id, actor_type, action, entity_type, entity_id, request_id, new_values, created_at)
            VALUES(gen_random_uuid(), @lot, @actor, 'STAFF', 'CHECK_IN', 'PARKING_SESSION', @entity, @request,
              jsonb_build_object('slotId', @slot, 'slotCode', @slotCode, 'status', 'ACTIVE', 'entryMethod', 'WALK_IN'), @entry);

            INSERT INTO outbox_events(id, lot_id, event_type, aggregate_id, payload, occurred_at, attempts)
            VALUES(gen_random_uuid(), @lot, 'CheckInSucceeded', @session,
              jsonb_build_object(
                'sessionId', @session,
                'lotId', @lot,
                'slotId', @slot,
                'slotCode', @slotCode,
                'gateId', @gate,
                'plate', @plate,
                'vehicleType', @type,
                'entryMethod', 'WALK_IN',
                'status', 'ACTIVE',
                'entryAt', @entry,
                'barrierAction', 'OPEN'
              ), @entry, 0);

            INSERT INTO integration_outbox(event_id, event_type, aggregate_id, payload, occurred_at)
            VALUES(@slotChangedId, 'SlotStatusChanged.v1', @slot, @slotChangedPayload::jsonb, @entry);
            """))
        {
            write.Parameters.AddWithValue("session", sessionId);
            write.Parameters.AddWithValue("vehicle", vehicleId);
            write.Parameters.AddWithValue("snapshot", snapshotId);
            write.Parameters.AddWithValue("slot", slotId);
            write.Parameters.AddWithValue("slotCode", slotCode);
            write.Parameters.AddWithValue("entry", entryAt.UtcDateTime);
            write.Parameters.AddWithValue("end", endsAt.UtcDateTime);
            write.Parameters.AddWithValue("entity", sessionId.ToString());
            write.Parameters.AddWithValue("request", requestId.ToString());
            write.Parameters.AddWithValue("slotChangedId", slotChangedEventId);
            write.Parameters.AddWithValue("slotChangedPayload", BuildSlotOccupiedEventPayload(slotChangedEventId, request.LotId, slotId, entryAt));
            await write.ExecuteNonQueryAsync(ct);
        }

        var response = new CheckInResponseDto(sessionId, null, request.LotId, slotId, "ACTIVE", entryAt, slotCode, vehicleType, "WALK_IN", levelName);

        await using (var outcome = Command("INSERT INTO integration_inbox(event_id,event_type,payload_hash,outcome) VALUES(@id,'CheckInWalkInRequest',@hash,@outcome)"))
        {
            outcome.Parameters.AddWithValue("id", requestId);
            outcome.Parameters.AddWithValue("hash", fingerprint);
            outcome.Parameters.AddWithValue("outcome", JsonSerializer.Serialize(response));
            await outcome.ExecuteNonQueryAsync(ct);
        }

        await transaction.CommitAsync(ct);
        return response;
    }

    private static string ComputeCheckInFingerprint(CheckInRequestDto request, string normalizedPlate, string? normalizedVehicleType)
    {
        var payload = JsonSerializer.SerializeToNode(new
        {
            request.LotId,
            request.GateId,
            request.QrPayload,
            Plate = normalizedPlate,
            VehicleType = normalizedVehicleType,
            request.AllowMismatchOverride,
            OverrideReason = request.OverrideReason?.Trim()
        })!;
        // Keep hashes compatible with requests recorded before evidence was added.
        if (request.Evidence is { Count: > 0 })
            payload["Evidence"] = JsonSerializer.SerializeToNode(request.Evidence);
        return Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(payload.ToJsonString())));
    }

    private static string BuildSlotOccupiedEventPayload(Guid eventId, Guid lotId, Guid slotId, DateTimeOffset observedAt) =>
        JsonSerializer.Serialize(new
        {
            eventId,
            parkingLotId = lotId,
            slotId,
            status = "OCCUPIED",
            observedAt
        });

    /// <summary>Ghi nhận sự cố lệch biển số bên ngoài transaction bị rollback để không mất vết cảnh báo tại cổng.</summary>
    private static async Task RecordRejectedPlateMismatchIncidentAsync(
        NpgsqlConnection connection,
        Guid lotId,
        Guid bookingId,
        Guid actorId,
        string observedPlate,
        string slotCode,
        string reason,
        string description,
        CancellationToken ct)
    {
        var incidentId = Guid.NewGuid();
        await using var cmd = new NpgsqlCommand("""
            INSERT INTO parking_issues(
                id, lot_id, booking_id, issue_type, status, reason, reported_by,
                title, severity, description, detected_at, related_plate, related_slot_code,
                version, created_at, updated_at)
            VALUES(
                @incidentId, @lot, @booking, 'INCIDENT_0482_PLATE_MISMATCH', 'Open', @reason, @actor,
                'Cảnh báo lệch biển số khi check-in', 'High', @description, clock_timestamp(), @plate, @slotCode,
                1, clock_timestamp(), clock_timestamp());
            INSERT INTO incident_history(
                id, incident_id, lot_id, action, from_status, to_status, performed_by_user_id, reason, performed_at)
            VALUES(
                gen_random_uuid(), @incidentId, @lot, 'CREATED', NULL, 'Open', @actor, @reason, clock_timestamp());
            """, connection);
        cmd.Parameters.AddWithValue("incidentId", incidentId);
        cmd.Parameters.AddWithValue("lot", lotId);
        cmd.Parameters.AddWithValue("booking", bookingId);
        cmd.Parameters.AddWithValue("reason", reason);
        cmd.Parameters.AddWithValue("actor", actorId);
        cmd.Parameters.AddWithValue("description", description);
        cmd.Parameters.AddWithValue("plate", observedPlate);
        cmd.Parameters.AddWithValue("slotCode", slotCode);
        await cmd.ExecuteNonQueryAsync(ct);
    }
}

