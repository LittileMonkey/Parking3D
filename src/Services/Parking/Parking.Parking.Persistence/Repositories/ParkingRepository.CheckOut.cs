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
    /// SCRUM-70: Tra cứu phiên đỗ ACTIVE theo biển số/QR, đối soát biển số và tính cước thực tế tại cổng ra.
    /// </summary>
    public async Task<CheckOutQuoteResultDto> GetCheckOutQuoteAsync(
        Guid lotId,
        Guid gateId,
        string detectedPlate,
        string? qrPayload,
        CancellationToken ct)
    {
        if (lotId == Guid.Empty || gateId == Guid.Empty)
            throw new ServiceException(400, "Valid lotId and gateId are required.");

        var searchPlate = string.Empty;
        var hasPlate = !string.IsNullOrWhiteSpace(detectedPlate) && PlateNumber.TryNormalize(detectedPlate, out searchPlate);
        if (!hasPlate && string.IsNullOrWhiteSpace(qrPayload))
            throw new ServiceException(400, "Valid detected plate or QR payload is required for check-out identification.");

        await using var connection = await db.OpenConnectionAsync(ct);

        // 1. Kiểm tra cổng ra có hợp lệ tại bãi này không
        await using (var gateCheck = new NpgsqlCommand(
            "SELECT EXISTS(SELECT 1 FROM lot_gates WHERE id=@gate AND lot_id=@lot AND gate_kind IN ('EXIT','BOTH'))", connection))
        {
            gateCheck.Parameters.AddWithValue("gate", gateId);
            gateCheck.Parameters.AddWithValue("lot", lotId);
            if (!(bool)(await gateCheck.ExecuteScalarAsync(ct))!)
                throw new ServiceException(400, "Invalid exit gate for the requested parking lot.");
        }

        // 2. Tra cứu phiên đỗ ACTIVE và thông tin tính cước
        await using var cmd = new NpgsqlCommand("""
            SELECT ps.id, ps.booking_id, s.id, s.code, ps.plate_snapshot,
                   ps.entry_at, ps.expected_exit_at, clock_timestamp(),
                   l.timezone, sn.resolved_rules, COALESCE(b.estimated_amount, 0)
            FROM parking_sessions ps
            JOIN session_slot_assignments a ON a.session_id = ps.id AND a.vacated_at IS NULL
            JOIN parking_slots s ON s.id = a.slot_id AND s.lot_id = ps.lot_id
            JOIN parking_lots l ON l.id = ps.lot_id
            JOIN pricing_snapshots sn ON sn.id = ps.pricing_snapshot_id
            LEFT JOIN bookings b ON b.id = ps.booking_id
            WHERE ps.lot_id = @lot
              AND ps.status = 'ACTIVE'
              AND (@hasPlate AND (ps.plate_snapshot = @plate OR ps.plate_snapshot = @rawPlate))
            LIMIT 1
            """, connection);

        cmd.Parameters.AddWithValue("lot", lotId);
        cmd.Parameters.AddWithValue("hasPlate", hasPlate);
        cmd.Parameters.AddWithValue("plate", searchPlate);
        cmd.Parameters.AddWithValue("rawPlate", detectedPlate?.Trim().ToUpperInvariant() ?? string.Empty);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct))
            throw new ServiceException(404, "No active parking session found for the specified vehicle at this lot.");

        var sessionId = reader.GetGuid(0);
        var bookingId = reader.IsDBNull(1) ? (Guid?)null : reader.GetGuid(1);
        var slotId = reader.GetGuid(2);
        var slotCode = reader.GetString(3);
        var entryPlate = reader.GetString(4);
        var entryAt = reader.GetFieldValue<DateTimeOffset>(5);
        var expectedExitAt = reader.GetFieldValue<DateTimeOffset>(6);
        var quoteAt = reader.GetFieldValue<DateTimeOffset>(7);
        var timezoneStr = reader.GetString(8);
        var rulesJson = reader.GetString(9);
        var prepaidAmount = reader.GetInt64(10);

        // 3. Đối soát biển số vào và ra (Kích hoạt cảnh báo #0482 nếu lệch)
        var isPlateMatched = string.Equals(entryPlate, searchPlate, StringComparison.OrdinalIgnoreCase) ||
                             string.Equals(entryPlate, detectedPlate?.Trim(), StringComparison.OrdinalIgnoreCase);
        string? incidentCode = isPlateMatched ? null : "INCIDENT_0482_PLATE_MISMATCH";

        // 4. Tính toán thời gian thực tế và cước phụ thu nếu đỗ quá giờ
        var totalMinutes = (int)Math.Max(0, (quoteAt - entryAt).TotalMinutes);
        var overdueMinutes = (int)Math.Max(0, (quoteAt - expectedExitAt).TotalMinutes);

        decimal overtimeAmount = 0;
        if (overdueMinutes > 0 && !string.IsNullOrWhiteSpace(rulesJson))
        {
            var tz = TimeZoneInfo.FindSystemTimeZoneById(timezoneStr);
            var blockPrice = JsonSerializer.Deserialize<BlockPrice>(rulesJson, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            if (blockPrice is not null)
            {
                overtimeAmount = blockPrice.Estimate(expectedExitAt, quoteAt, tz);
            }
        }

        var totalAmountDue = overtimeAmount;
        var paymentRequired = totalAmountDue > 0;

        return new CheckOutQuoteResultDto(
            sessionId,
            bookingId,
            slotId,
            slotCode,
            entryPlate,
            detectedPlate ?? searchPlate,
            isPlateMatched,
            entryAt,
            expectedExitAt,
            quoteAt,
            totalMinutes,
            overdueMinutes,
            prepaidAmount,
            overtimeAmount,
            totalAmountDue,
            paymentRequired,
            incidentCode);
    }

    /// <summary>
    /// SCRUM-70: Khóa slot_id, xác nhận thanh toán, đóng session COMPLETED, giải phóng slot và ghi audit nguyên tử.
    /// </summary>
    public async Task<ConfirmCheckOutResultDto> CompleteCheckOutAsync(
        Guid actorId,
        ConfirmCheckOutRequestDto request,
        string key,
        CancellationToken ct)
    {
        if (actorId == Guid.Empty || request.SessionId == Guid.Empty || request.GateId == Guid.Empty ||
            string.IsNullOrWhiteSpace(key) || key.Length > 128)
            throw new ServiceException(400, "Valid actor, session, gate and Idempotency-Key required.");

        await using var connection = await db.OpenConnectionAsync(ct);
        await using var transaction = await connection.BeginTransactionAsync(ct);

        // 1. Chống gửi lặp request qua Idempotency-Key
        var dedupeKey = $"CheckOut:{actorId}:{key}";
        var requestId = new Guid(SHA256.HashData(Encoding.UTF8.GetBytes(dedupeKey)).AsSpan(0, 16));
        var fingerprint = Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(request))));

        await using (var claim = new NpgsqlCommand("SELECT pg_advisory_xact_lock(hashtextextended(@key,0))", connection, transaction))
        {
            claim.Parameters.AddWithValue("key", dedupeKey);
            await claim.ExecuteNonQueryAsync(ct);
        }

        await using (var replay = new NpgsqlCommand("SELECT payload_hash,outcome FROM integration_inbox WHERE event_id=@id AND event_type='CheckOutRequest'", connection, transaction))
        {
            replay.Parameters.AddWithValue("id", requestId);
            await using var reader = await replay.ExecuteReaderAsync(ct);
            if (await reader.ReadAsync(ct))
            {
                if (reader.GetString(0) != fingerprint)
                    throw new ServiceException(409, "Idempotency key reused for a different check-out request.");
                return JsonSerializer.Deserialize<ConfirmCheckOutResultDto>(reader.GetString(1))!;
            }
        }

        // 2. Tra cứu phiên đỗ ACTIVE và khóa tài nguyên
        Guid lotId;
        Guid? bookingId;
        Guid vehicleId;
        Guid slotId;
        string slotCode;
        DateTimeOffset expectedExitAt;
        string rulesJson;
        string timezoneStr;

        await using (var locate = new NpgsqlCommand("""
            SELECT ps.lot_id, ps.booking_id, ps.vehicle_id, a.slot_id, s.code,
                   ps.expected_exit_at, sn.resolved_rules, l.timezone
            FROM parking_sessions ps
            JOIN session_slot_assignments a ON a.session_id = ps.id AND a.vacated_at IS NULL
            JOIN parking_slots s ON s.id = a.slot_id
            JOIN parking_lots l ON l.id = ps.lot_id
            JOIN pricing_snapshots sn ON sn.id = ps.pricing_snapshot_id
            WHERE ps.id = @session AND ps.status = 'ACTIVE'
              AND EXISTS(SELECT 1 FROM lot_gates g WHERE g.id = @gate AND g.lot_id = ps.lot_id AND g.gate_kind IN ('EXIT','BOTH'))
            FOR UPDATE OF ps, a
            """, connection, transaction))
        {
            locate.Parameters.AddWithValue("session", request.SessionId);
            locate.Parameters.AddWithValue("gate", request.GateId);
            await using var reader = await locate.ExecuteReaderAsync(ct);
            if (!await reader.ReadAsync(ct))
                throw new ServiceException(409, "Parking session is not active or invalid exit gate.");

            lotId = reader.GetGuid(0);
            bookingId = reader.IsDBNull(1) ? (Guid?)null : reader.GetGuid(1);
            vehicleId = reader.GetGuid(2);
            slotId = reader.GetGuid(3);
            slotCode = reader.GetString(4);
            expectedExitAt = reader.GetFieldValue<DateTimeOffset>(5);
            rulesJson = reader.GetString(6);
            timezoneStr = reader.GetString(7);
        }

        // 3. Khóa chống tranh chấp VEHICLE và SLOT
        await using (var vehicleLock = new NpgsqlCommand("SELECT lock_parking_resource('VEHICLE', @vehicle)", connection, transaction))
        {
            vehicleLock.Parameters.AddWithValue("vehicle", vehicleId);
            await vehicleLock.ExecuteNonQueryAsync(ct);
        }

        await using (var slotLock = new NpgsqlCommand("SELECT lock_parking_resource('SLOT', @slot)", connection, transaction))
        {
            slotLock.Parameters.AddWithValue("slot", slotId);
            await slotLock.ExecuteNonQueryAsync(ct);
        }

        // 4. Kiểm tra điều kiện cước phụ thu quá giờ
        var now = clock.GetUtcNow();
        decimal overtimeDue = 0;
        if (now > expectedExitAt && !string.IsNullOrWhiteSpace(rulesJson))
        {
            var tz = TimeZoneInfo.FindSystemTimeZoneById(timezoneStr);
            var blockPrice = JsonSerializer.Deserialize<BlockPrice>(rulesJson, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            if (blockPrice is not null)
            {
                overtimeDue = blockPrice.Estimate(expectedExitAt, now, tz);
            }
        }

        if (overtimeDue > 0)
        {
            if (request.PaymentMethod == "NONE")
                throw new ServiceException(409, $"Payment required: {overtimeDue:N0} VND must be paid before check-out.");

            if (request.PaymentMethod == "CASH" && request.CashReceived < overtimeDue)
                throw new ServiceException(409, $"Insufficient cash received: required {overtimeDue:N0} VND, but received {request.CashReceived:N0} VND.");
        }

        // 5. Cập nhật Database: parking_sessions COMPLETED, assignment vacated_at, booking COMPLETED
        await using (var complete = new NpgsqlCommand("""
            UPDATE parking_sessions
            SET status = 'COMPLETED',
                exit_at = @now,
                exit_gate_id = @gate,
                exited_by = @actor
            WHERE id = @session;

            UPDATE session_slot_assignments
            SET vacated_at = @now
            WHERE session_id = @session AND vacated_at IS NULL;

            UPDATE bookings
            SET status = 'COMPLETED',
                version = version + 1
            WHERE id = @booking;

            INSERT INTO audit_logs(id, lot_id, actor_user_id, actor_type, action, entity_type, entity_id, request_id, new_values, created_at)
            VALUES(gen_random_uuid(), @lot, @actor, 'STAFF', 'CHECK_OUT', 'PARKING_SESSION', @session::text, @requestId,
              jsonb_build_object('status', 'COMPLETED', 'slotId', @slot, 'paymentMethod', @method, 'amountPaid', @paid), @now);
            """, connection, transaction))
        {
            complete.Parameters.AddWithValue("session", request.SessionId);
            complete.Parameters.AddWithValue("now", now.UtcDateTime);
            complete.Parameters.AddWithValue("gate", request.GateId);
            complete.Parameters.AddWithValue("actor", actorId);
            complete.Parameters.AddWithValue("booking", (object?)bookingId ?? DBNull.Value);
            complete.Parameters.AddWithValue("lot", lotId);
            complete.Parameters.AddWithValue("requestId", requestId.ToString());
            complete.Parameters.AddWithValue("slot", slotId.ToString());
            complete.Parameters.AddWithValue("method", request.PaymentMethod);
            complete.Parameters.AddWithValue("paid", overtimeDue);
            await complete.ExecuteNonQueryAsync(ct);
        }

        var result = new ConfirmCheckOutResultDto(
            request.SessionId,
            bookingId,
            lotId,
            slotId,
            slotCode,
            now,
            overtimeDue,
            request.PaymentMethod,
            BarrierStatus: "OPEN",
            SlotStatus: "AVAILABLE");

        // 6. Ghi nhận outcome vào integration_inbox để bảo vệ idempotency
        await using (var dedupe = new NpgsqlCommand("INSERT INTO integration_inbox(event_id,event_type,payload_hash,outcome) VALUES(@id,'CheckOutRequest',@hash,@outcome)", connection, transaction))
        {
            dedupe.Parameters.AddWithValue("id", requestId);
            dedupe.Parameters.AddWithValue("hash", fingerprint);
            dedupe.Parameters.AddWithValue("outcome", JsonSerializer.Serialize(result));
            await dedupe.ExecuteNonQueryAsync(ct);
        }

        await transaction.CommitAsync(ct);
        return result;
    }
}
