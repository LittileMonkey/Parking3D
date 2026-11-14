using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Npgsql;
using Parking.Parking.Application.DTOs;
using Parking.Parking.Domain;
using Parking.ServiceDefaults;

namespace Parking.Parking.Persistence.Repositories;

public sealed partial class ParkingRepository
{
    /// <summary>
    /// Đăng ký xe vãng lai, chọn ô bằng advisory try-lock trước row SKIP LOCKED,
    /// rồi tạo session, occupancy, audit và outcome trong cùng transaction.
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

        var vehicleId = await RegisterAndLockWalkInVehicleAsync(Command, vehicleType, ct);

        var (slotId, slotCode, levelName) = await AllocateWalkInSlotAsync(Command, transaction, entryAt, endsAt, ct);

        var snapshotId = await GetOrCreateWalkInPricingSnapshotAsync(Command, entryAt, holdMinutes, lateArrivalMinutes, ct);

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
}
