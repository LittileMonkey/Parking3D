using Npgsql;
using NpgsqlTypes;
using Parking.Parking.Application.DTOs;
using Parking.ServiceDefaults;

namespace Parking.Parking.Persistence.Repositories;

public sealed partial class ParkingRepository
{
    /// <summary>
    /// Tạo biên bản bàn giao ca trực mới: cấm tự giao tự nhận, khóa advisory lock và lưu outcome chống trùng lặp.
    /// </summary>
    public async Task<ShiftHandoverDto> CreateShiftHandoverAsync(
        Guid lotId,
        Guid actorId,
        CreateShiftHandoverRequestDto request,
        string? key,
        CancellationToken ct)
    {
        if (lotId == Guid.Empty) throw new ServiceException(400, "Valid lotId is required.");
        if (request.SenderShiftId == Guid.Empty || request.ReceiverShiftId == Guid.Empty)
            throw new ServiceException(400, "Valid senderShiftId and receiverShiftId are required.");
        if (request.ReceiverUserId == Guid.Empty)
            throw new ServiceException(400, "Valid receiverUserId is required.");
        if (request.ReceiverUserId == actorId)
            throw new ServiceException(400, "Người bàn giao và người nhận ca không được là cùng một người (không tự giao tự nhận).");

        if (string.IsNullOrWhiteSpace(request.CompletedTasks) || request.CompletedTasks.Length > 2000)
            throw new ServiceException(400, "CompletedTasks is required and must not exceed 2000 characters.");
        if (string.IsNullOrWhiteSpace(request.UnresolvedIssues) || request.UnresolvedIssues.Length > 2000)
            throw new ServiceException(400, "UnresolvedIssues is required and must not exceed 2000 characters.");
        if (string.IsNullOrWhiteSpace(request.PendingTransactions) || request.PendingTransactions.Length > 2000)
            throw new ServiceException(400, "PendingTransactions is required and must not exceed 2000 characters.");
        if (string.IsNullOrWhiteSpace(request.NotesForNext) || request.NotesForNext.Length > 2000)
            throw new ServiceException(400, "NotesForNext is required and must not exceed 2000 characters.");

        await using var conn = await db.OpenConnectionAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);

        var (replayed, existingOutcome, requestId, fingerprint) = await TryReplayRequestAsync<ShiftHandoverDto>(
            conn, tx, $"CreateShiftHandover:{lotId}:{actorId}", "CreateShiftHandover", request, key, ct);
        if (replayed)
        {
            await tx.CommitAsync(ct);
            return existingOutcome!;
        }

        await using (var shifts = new NpgsqlCommand("""
            SELECT id,staff_user_id FROM staff_shifts WHERE lot_id=@lot AND ended_at IS NULL
              AND id IN (@sender,@receiver) ORDER BY id FOR UPDATE
            """, conn, tx))
        {
            shifts.Parameters.AddWithValue("lot",lotId); shifts.Parameters.AddWithValue("sender",request.SenderShiftId); shifts.Parameters.AddWithValue("receiver",request.ReceiverShiftId);
            await using var reader=await shifts.ExecuteReaderAsync(ct); var sender=false; var receiver=false;
            while(await reader.ReadAsync(ct))
            { sender |= reader.GetGuid(0)==request.SenderShiftId && reader.GetGuid(1)==actorId; receiver |= reader.GetGuid(0)==request.ReceiverShiftId && reader.GetGuid(1)==request.ReceiverUserId; }
            if(!sender || !receiver) throw new ServiceException(409,"Both staff must have active shifts in this lot.");
        }
        await using (var pending = new NpgsqlCommand("SELECT EXISTS(SELECT 1 FROM shift_handovers WHERE sender_shift_id IN (@sender,@receiver) AND status='PendingConfirmation')",conn,tx))
        {
            pending.Parameters.AddWithValue("sender",request.SenderShiftId);pending.Parameters.AddWithValue("receiver",request.ReceiverShiftId);
            if((bool)(await pending.ExecuteScalarAsync(ct))!)throw new ServiceException(409,"A shift already has a pending handover.");
        }
        var handoverId = Guid.NewGuid();
        var now = clock.GetUtcNow();

        await using (var insertCmd = new NpgsqlCommand("""
            INSERT INTO shift_handovers (
                id, lot_id, sender_shift_id, receiver_shift_id, sender_user_id, receiver_user_id,
                completed_tasks, unresolved_issues, pending_transactions, equipment_status, notes_for_next,
                status, created_at, confirmed_at, confirmed_by_user_id, version
            ) VALUES (
                @id, @lotId, @senderShiftId, @receiverShiftId, @senderUserId, @receiverUserId,
                @completedTasks, @unresolvedIssues, @pendingTransactions, @equipmentStatus, @notesForNext,
                'PendingConfirmation', @now, NULL, NULL, 1
            )
            """, conn, tx))
        {
            insertCmd.Parameters.AddWithValue("id", handoverId);
            insertCmd.Parameters.AddWithValue("lotId", lotId);
            insertCmd.Parameters.AddWithValue("senderShiftId", request.SenderShiftId);
            insertCmd.Parameters.AddWithValue("receiverShiftId", request.ReceiverShiftId);
            insertCmd.Parameters.AddWithValue("senderUserId", actorId);
            insertCmd.Parameters.AddWithValue("receiverUserId", request.ReceiverUserId);
            insertCmd.Parameters.AddWithValue("completedTasks", request.CompletedTasks.Trim());
            insertCmd.Parameters.AddWithValue("unresolvedIssues", request.UnresolvedIssues.Trim());
            insertCmd.Parameters.AddWithValue("pendingTransactions", request.PendingTransactions.Trim());
            insertCmd.Parameters.Add("equipmentStatus", NpgsqlDbType.Text).Value = (object?)request.EquipmentStatus?.Trim() ?? DBNull.Value;
            insertCmd.Parameters.AddWithValue("notesForNext", request.NotesForNext.Trim());
            insertCmd.Parameters.AddWithValue("now", now);
            await insertCmd.ExecuteNonQueryAsync(ct);
        }

        await using (var histCmd = new NpgsqlCommand("""
            INSERT INTO shift_handover_history (
                id, handover_id, lot_id, action, old_receiver_user_id, new_receiver_user_id,
                performed_by_user_id, reason, performed_at
            ) VALUES (
                gen_random_uuid(), @handoverId, @lotId, 'CREATED', NULL, @receiverUserId,
                @actorId, 'Khởi tạo biên bản bàn giao ca', @now
            )
            """, conn, tx))
        {
            histCmd.Parameters.AddWithValue("handoverId", handoverId);
            histCmd.Parameters.AddWithValue("lotId", lotId);
            histCmd.Parameters.AddWithValue("receiverUserId", request.ReceiverUserId);
            histCmd.Parameters.AddWithValue("actorId", actorId);
            histCmd.Parameters.AddWithValue("now", now);
            await histCmd.ExecuteNonQueryAsync(ct);
        }

        await AppendAuditLogAsync(
            conn, tx, lotId, actorId,
            action: "CREATE_SHIFT_HANDOVER",
            entityType: "SHIFT_HANDOVER",
            entityId: handoverId.ToString(),
            reason: null,
            requestId: requestId?.ToString(),
            oldValues: null,
            newValues: new { senderShiftId = request.SenderShiftId, receiverShiftId = request.ReceiverShiftId, receiverUserId = request.ReceiverUserId, status = "PendingConfirmation", version = 1 },
            now: now, ct: ct);

        var result = new ShiftHandoverDto(
            HandoverId: handoverId,
            LotId: lotId,
            SenderShiftId: request.SenderShiftId,
            ReceiverShiftId: request.ReceiverShiftId,
            SenderUserId: actorId,
            ReceiverUserId: request.ReceiverUserId,
            CompletedTasks: request.CompletedTasks.Trim(),
            UnresolvedIssues: request.UnresolvedIssues.Trim(),
            PendingTransactions: request.PendingTransactions.Trim(),
            EquipmentStatus: request.EquipmentStatus?.Trim(),
            NotesForNext: request.NotesForNext.Trim(),
            Status: "PendingConfirmation",
            CreatedAt: now,
            ConfirmedAt: null,
            ConfirmedByUserId: null,
            Version: 1
        );

        await SaveRequestOutcomeAsync(conn, tx, requestId, "CreateShiftHandover", fingerprint, result, now, ct);

        await tx.CommitAsync(ct);
        return result;
    }
}
