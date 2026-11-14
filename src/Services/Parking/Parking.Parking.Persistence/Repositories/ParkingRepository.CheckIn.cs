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
}
