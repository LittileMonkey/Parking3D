using Npgsql;
using Parking.Parking.Application.DTOs;
using Parking.ServiceDefaults;

namespace Parking.Parking.Persistence.Repositories;

public sealed partial class ParkingRepository
{
    public Task<ShiftHandoverDto> ReassignReceiverAsync(
        Guid lotId,
        Guid handoverId,
        Guid actorId,
        ReassignReceiverRequestDto request,
        CancellationToken ct)
        => ReassignReceiverAsync(lotId, handoverId, actorId, request, null, ct);

    /// <summary>
    /// Quản lý chỉ định lại nhân viên nhận ca khi người cũ vắng mặt hoặc bị khóa, cập nhật version, ghi lịch sử, audit log và idempotency.
    /// </summary>
    public async Task<ShiftHandoverDto> ReassignReceiverAsync(
        Guid lotId,
        Guid handoverId,
        Guid actorId,
        ReassignReceiverRequestDto request,
        string? key,
        CancellationToken ct)
    {
        if (request.ReceiverUserId == Guid.Empty)
            throw new ServiceException(400, "Valid receiverUserId is required.");
        if (string.IsNullOrWhiteSpace(request.Reason) || request.Reason.Trim().Length > 2000)
            throw new ServiceException(400, "Lý do thay đổi người nhận ca (reason) là bắt buộc và tối đa 2000 ký tự.");

        var reason = request.Reason.Trim();
        await using var conn = await db.OpenConnectionAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);

        var (replayed, existingOutcome, requestId, fingerprint) = await TryReplayRequestAsync<ShiftHandoverDto>(
            conn, tx, $"ReassignShiftHandoverReceiver:{lotId}:{handoverId}:{actorId}", "ReassignShiftHandoverReceiver", request, key, ct);
        if (replayed)
        {
            await tx.CommitAsync(ct);
            return existingOutcome!;
        }

        Guid senderUserId;
        Guid oldReceiverUserId;
        string status;
        int version;

        await using (var lockCmd = new NpgsqlCommand("""
            SELECT sender_user_id, receiver_user_id, status, version
            FROM shift_handovers
            WHERE lot_id = @lotId AND id = @handoverId
            """, conn, tx))
        {
            lockCmd.Parameters.AddWithValue("lotId", lotId);
            lockCmd.Parameters.AddWithValue("handoverId", handoverId);
            await using var r = await lockCmd.ExecuteReaderAsync(ct);
            if (!await r.ReadAsync(ct))
                throw new ServiceException(404, "Biên bản bàn giao ca không tồn tại.");
            senderUserId = r.GetGuid(0);
            oldReceiverUserId = r.GetGuid(1);
            status = r.GetString(2);
            version = r.GetInt32(3);
        }

        if (!string.Equals(status, "PendingConfirmation", StringComparison.OrdinalIgnoreCase))
        {
            throw new ServiceException(409, "Chỉ có thể đổi người nhận ca khi biên bản đang ở trạng thái PendingConfirmation.");
        }

        if (request.ReceiverUserId == senderUserId)
        {
            throw new ServiceException(400, "Người nhận ca mới không được trùng với người giao ca (cấm tự giao tự nhận).");
        }

        if (request.ReceiverUserId == oldReceiverUserId)
        {
            throw new ServiceException(400, "Người nhận ca mới trùng với người nhận hiện tại.");
        }

        if (version != request.ExpectedVersion)
        {
            throw new ServiceException(409, $"Xung đột dữ liệu: Phiên bản hiện tại là {version}, mong muốn {request.ExpectedVersion}.");
        }

        var now = clock.GetUtcNow();

        await using (var updateCmd = new NpgsqlCommand("""
            UPDATE shift_handovers
            SET receiver_user_id = @newReceiver,
                receiver_shift_id = @newShift,
                version = version + 1
            WHERE lot_id = @lotId AND id = @handoverId AND version = @expectedVersion
            """, conn, tx))
        {
            await using var shiftCmd=new NpgsqlCommand("SELECT id FROM staff_shifts WHERE lot_id=@lot AND staff_user_id=@user AND ended_at IS NULL FOR UPDATE",conn,tx);
            shiftCmd.Parameters.AddWithValue("lot",lotId);shiftCmd.Parameters.AddWithValue("user",request.ReceiverUserId);
            var shiftId=await shiftCmd.ExecuteScalarAsync(ct);
            if(shiftId is not Guid)throw new ServiceException(409,"Receiver must start a shift in this lot first.");
            updateCmd.Parameters.AddWithValue("newShift",(Guid)shiftId);
            updateCmd.Parameters.AddWithValue("newReceiver", request.ReceiverUserId);
            updateCmd.Parameters.AddWithValue("lotId", lotId);
            updateCmd.Parameters.AddWithValue("handoverId", handoverId);
            updateCmd.Parameters.AddWithValue("expectedVersion", request.ExpectedVersion);
            if (await updateCmd.ExecuteNonQueryAsync(ct) != 1)
                throw new ServiceException(409, "Handover changed. Refresh the current version and retry.");
        }

        await using (var histCmd = new NpgsqlCommand("""
            INSERT INTO shift_handover_history (
                id, handover_id, lot_id, action, old_receiver_user_id, new_receiver_user_id,
                performed_by_user_id, reason, performed_at
            ) VALUES (
                gen_random_uuid(), @handoverId, @lotId, 'RECEIVER_REASSIGNED', @oldReceiver, @newReceiver,
                @actorId, @reason, @now
            )
            """, conn, tx))
        {
            histCmd.Parameters.AddWithValue("handoverId", handoverId);
            histCmd.Parameters.AddWithValue("lotId", lotId);
            histCmd.Parameters.AddWithValue("oldReceiver", oldReceiverUserId);
            histCmd.Parameters.AddWithValue("newReceiver", request.ReceiverUserId);
            histCmd.Parameters.AddWithValue("actorId", actorId);
            histCmd.Parameters.AddWithValue("reason", reason);
            histCmd.Parameters.AddWithValue("now", now);
            await histCmd.ExecuteNonQueryAsync(ct);
        }

        await AppendAuditLogAsync(
            conn, tx, lotId, actorId,
            action: "REASSIGN_SHIFT_HANDOVER_RECEIVER",
            entityType: "SHIFT_HANDOVER",
            entityId: handoverId.ToString(),
            reason: reason,
            requestId: requestId?.ToString(),
            oldValues: new { receiverUserId = oldReceiverUserId, version },
            newValues: new { receiverUserId = request.ReceiverUserId, version = version + 1 },
            now: now, ct: ct);

        var updated = (await ReadShiftHandoverByIdAsync(conn, tx, lotId, handoverId, actorId, isManager: true, ct))!;
        await SaveRequestOutcomeAsync(conn, tx, requestId, "ReassignShiftHandoverReceiver", fingerprint, updated, now, ct);

        await tx.CommitAsync(ct);
        return updated;
    }
}
