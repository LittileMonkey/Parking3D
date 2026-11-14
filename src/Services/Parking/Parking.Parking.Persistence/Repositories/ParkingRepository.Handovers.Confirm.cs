using Npgsql;
using Parking.Parking.Application.DTOs;
using Parking.ServiceDefaults;

namespace Parking.Parking.Persistence.Repositories;

public sealed partial class ParkingRepository
{
    /// <summary>
    /// Nhân viên nhận ca xác nhận bằng version guard, ghi audit log và idempotency.
    /// </summary>
    public async Task<ShiftHandoverDto> ConfirmShiftHandoverAsync(
        Guid lotId,
        Guid handoverId,
        Guid actorId,
        ConfirmShiftHandoverRequestDto request,
        string? key,
        CancellationToken ct)
    {
        await using var conn = await db.OpenConnectionAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);

        var (replayed, existingOutcome, requestId, fingerprint) = await TryReplayRequestAsync<ShiftHandoverDto>(
            conn, tx, $"ConfirmShiftHandover:{lotId}:{handoverId}:{actorId}", "ConfirmShiftHandover", request, key, ct);
        if (replayed)
        {
            await tx.CommitAsync(ct);
            return existingOutcome!;
        }

        Guid receiverUserId;
        string status;
        int version;
        Guid? confirmedBy;

        await using (var lockCmd = new NpgsqlCommand("""
            SELECT receiver_user_id, status, version, confirmed_by_user_id
            FROM shift_handovers
            WHERE lot_id = @lotId AND id = @handoverId
            """, conn, tx))
        {
            lockCmd.Parameters.AddWithValue("lotId", lotId);
            lockCmd.Parameters.AddWithValue("handoverId", handoverId);
            await using var r = await lockCmd.ExecuteReaderAsync(ct);
            if (!await r.ReadAsync(ct))
                throw new ServiceException(404, "Biên bản bàn giao ca không tồn tại.");
            receiverUserId = r.GetGuid(0);
            status = r.GetString(1);
            version = r.GetInt32(2);
            confirmedBy = r.IsDBNull(3) ? null : r.GetGuid(3);
        }

        if (actorId != receiverUserId)
        {
            throw new ServiceException(403, "Chỉ nhân viên được chỉ định nhận ca mới có quyền xác nhận nhận ca.");
        }

        var now = clock.GetUtcNow();
        if (string.Equals(status, "Confirmed", StringComparison.OrdinalIgnoreCase))
        {
            if (confirmedBy == actorId)
            {
                // Idempotent repeat confirmation by same receiver: return existing without changing version or adding audit.
                var existing = (await ReadShiftHandoverByIdAsync(conn, tx, lotId, handoverId, actorId, isManager: true, ct))!;
                await SaveRequestOutcomeAsync(conn, tx, requestId, "ConfirmShiftHandover", fingerprint, existing, now, ct);
                await tx.CommitAsync(ct);
                return existing;
            }
            throw new ServiceException(409, "Biên bản bàn giao ca này đã được xác nhận trước đó.");
        }

        if (!string.Equals(status, "PendingConfirmation", StringComparison.OrdinalIgnoreCase))
        {
            throw new ServiceException(409, $"Không thể xác nhận bàn giao ca đang ở trạng thái {status}.");
        }

        if (version != request.ExpectedVersion)
        {
            throw new ServiceException(409, $"Xung đột dữ liệu: Phiên bản hiện tại là {version}, mong muốn {request.ExpectedVersion}.");
        }

        // Both shifts must still be active at the handshake, not only when it was proposed.
        await using (var shifts = new NpgsqlCommand("""
            SELECT s.id FROM staff_shifts s
            JOIN shift_handovers h ON s.id IN (h.sender_shift_id,h.receiver_shift_id)
            WHERE h.id=@handoverId AND h.lot_id=@lotId AND s.lot_id=@lotId
              AND s.ended_at IS NULL
            ORDER BY s.id FOR UPDATE OF s
            """, conn, tx))
        {
            shifts.Parameters.AddWithValue("lotId", lotId);
            shifts.Parameters.AddWithValue("handoverId", handoverId);
            await using var reader = await shifts.ExecuteReaderAsync(ct);
            var active = 0;
            while (await reader.ReadAsync(ct)) active++;
            if (active != 2) throw new ServiceException(409, "Ca giao hoặc ca nhận đã kết thúc. Hãy cập nhật người nhận ca.");
        }

        await using (var updateCmd = new NpgsqlCommand("""
            UPDATE shift_handovers
            SET status = 'Confirmed',
                confirmed_at = @now,
                confirmed_by_user_id = @actorId,
                version = version + 1
            WHERE lot_id = @lotId AND id = @handoverId AND version = @expectedVersion
            """, conn, tx))
        {
            updateCmd.Parameters.AddWithValue("now", now);
            updateCmd.Parameters.AddWithValue("actorId", actorId);
            updateCmd.Parameters.AddWithValue("lotId", lotId);
            updateCmd.Parameters.AddWithValue("handoverId", handoverId);
            updateCmd.Parameters.AddWithValue("expectedVersion", request.ExpectedVersion);
            if (await updateCmd.ExecuteNonQueryAsync(ct) != 1)
                throw new ServiceException(409, "Handover changed. Refresh the current version and retry.");
        }

        await using (var endShift = new NpgsqlCommand("""
            UPDATE staff_shifts SET ended_at=@now
            WHERE id=(SELECT sender_shift_id FROM shift_handovers WHERE id=@handoverId AND lot_id=@lotId)
              AND lot_id=@lotId AND ended_at IS NULL
            """, conn, tx))
        {
            endShift.Parameters.AddWithValue("now", now);
            endShift.Parameters.AddWithValue("handoverId", handoverId);
            endShift.Parameters.AddWithValue("lotId", lotId);
            await endShift.ExecuteNonQueryAsync(ct);
        }

        await using (var histCmd = new NpgsqlCommand("""
            INSERT INTO shift_handover_history (
                id, handover_id, lot_id, action, old_receiver_user_id, new_receiver_user_id,
                performed_by_user_id, reason, performed_at
            ) VALUES (
                gen_random_uuid(), @handoverId, @lotId, 'CONFIRMED', NULL, @actorId,
                @actorId, 'Nhân viên nhận ca xác nhận hoàn tất nhận ca', @now
            )
            """, conn, tx))
        {
            histCmd.Parameters.AddWithValue("handoverId", handoverId);
            histCmd.Parameters.AddWithValue("lotId", lotId);
            histCmd.Parameters.AddWithValue("actorId", actorId);
            histCmd.Parameters.AddWithValue("now", now);
            await histCmd.ExecuteNonQueryAsync(ct);
        }

        await AppendAuditLogAsync(
            conn, tx, lotId, actorId,
            action: "CONFIRM_SHIFT_HANDOVER",
            entityType: "SHIFT_HANDOVER",
            entityId: handoverId.ToString(),
            reason: null,
            requestId: requestId?.ToString(),
            oldValues: new { status = "PendingConfirmation", version },
            newValues: new { status = "Confirmed", confirmedByUserId = actorId, version = version + 1 },
            now: now, ct: ct);

        var confirmed = (await ReadShiftHandoverByIdAsync(conn, tx, lotId, handoverId, actorId, isManager: true, ct))!;
        await SaveRequestOutcomeAsync(conn, tx, requestId, "ConfirmShiftHandover", fingerprint, confirmed, now, ct);

        await tx.CommitAsync(ct);
        return confirmed;
    }
}
