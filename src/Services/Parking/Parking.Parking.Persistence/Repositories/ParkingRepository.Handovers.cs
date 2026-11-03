using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
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

        Guid? requestId = null;
        string? fingerprint = null;
        if (!string.IsNullOrWhiteSpace(key))
        {
            if (key.Length > 128) throw new ServiceException(400, "Idempotency-Key must not exceed 128 characters.");
            requestId = new Guid(SHA256.HashData(Encoding.UTF8.GetBytes(actorId + ":handover:" + key)).AsSpan(0, 16));
            fingerprint = Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(request, JsonOptions))));

            await using var lockCmd = new NpgsqlCommand("SELECT pg_advisory_xact_lock(hashtextextended(@key,0))", conn, tx);
            lockCmd.Parameters.AddWithValue("key", actorId + ":handover:" + key);
            await lockCmd.ExecuteNonQueryAsync(ct);

            await using var inboxCmd = new NpgsqlCommand("SELECT payload_hash, outcome FROM integration_inbox WHERE event_id=@id AND event_type='CreateShiftHandover'", conn, tx);
            inboxCmd.Parameters.AddWithValue("id", requestId.Value);
            await using var r = await inboxCmd.ExecuteReaderAsync(ct);
            if (await r.ReadAsync(ct))
            {
                if (r.GetString(0) != fingerprint)
                    throw new ServiceException(409, "Idempotency key reused for a different handover payload.");
                return JsonSerializer.Deserialize<ShiftHandoverDto>(r.GetString(1), JsonOptions)!;
            }
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

        if (requestId.HasValue && fingerprint is not null)
        {
            await using var saveInbox = new NpgsqlCommand("""
                INSERT INTO integration_inbox(event_id, event_type, payload_hash, outcome, received_at)
                VALUES (@id, 'CreateShiftHandover', @hash, @outcome, @now)
                ON CONFLICT (event_id) DO NOTHING
                """, conn, tx);
            saveInbox.Parameters.AddWithValue("id", requestId.Value);
            saveInbox.Parameters.AddWithValue("hash", fingerprint);
            saveInbox.Parameters.AddWithValue("outcome", JsonSerializer.Serialize(result, JsonOptions));
            saveInbox.Parameters.AddWithValue("now", now);
            await saveInbox.ExecuteNonQueryAsync(ct);
        }

        await tx.CommitAsync(ct);
        return result;
    }

    /// <summary>
    /// Lấy danh sách biên bản bàn giao ca có lọc phạm vi (Staff xem bản mình gửi/nhận; Manager xem toàn bộ bãi).
    /// </summary>
    public async Task<PagedResult<ShiftHandoverSummaryDto>> ListShiftHandoversAsync(
        Guid lotId,
        Guid actorId,
        bool isManager,
        string? status,
        int page,
        int pageSize,
        CancellationToken ct)
    {
        if (page < 1) page = 1;
        if (pageSize < 1) pageSize = 25;
        if (pageSize > 100) pageSize = 100;
        var offset = (page - 1) * pageSize;

        await using var conn = await db.OpenConnectionAsync(ct);

        var whereClause = new StringBuilder("WHERE lot_id = @lotId");
        if (!isManager)
        {
            whereClause.Append(" AND (sender_user_id = @actorId OR receiver_user_id = @actorId)");
        }
        if (!string.IsNullOrWhiteSpace(status) && !string.Equals(status, "All", StringComparison.OrdinalIgnoreCase))
        {
            whereClause.Append(" AND status = @status");
        }

        var countSql = $"SELECT COUNT(*) FROM shift_handovers {whereClause}";
        int totalCount;
        await using (var countCmd = new NpgsqlCommand(countSql, conn))
        {
            countCmd.Parameters.AddWithValue("lotId", lotId);
            if (!isManager) countCmd.Parameters.AddWithValue("actorId", actorId);
            if (!string.IsNullOrWhiteSpace(status) && !string.Equals(status, "All", StringComparison.OrdinalIgnoreCase))
                countCmd.Parameters.AddWithValue("status", status);
            totalCount = Convert.ToInt32(await countCmd.ExecuteScalarAsync(ct));
        }

        var listSql = $"""
            SELECT id, lot_id, sender_shift_id, receiver_shift_id, sender_user_id, receiver_user_id,
                   status, created_at, confirmed_at, version
            FROM shift_handovers
            {whereClause}
            ORDER BY created_at DESC, id DESC
            LIMIT @limit OFFSET @offset
            """;

        var items = new List<ShiftHandoverSummaryDto>();
        await using (var listCmd = new NpgsqlCommand(listSql, conn))
        {
            listCmd.Parameters.AddWithValue("lotId", lotId);
            if (!isManager) listCmd.Parameters.AddWithValue("actorId", actorId);
            if (!string.IsNullOrWhiteSpace(status) && !string.Equals(status, "All", StringComparison.OrdinalIgnoreCase))
                listCmd.Parameters.AddWithValue("status", status);
            listCmd.Parameters.AddWithValue("limit", pageSize);
            listCmd.Parameters.AddWithValue("offset", offset);

            await using var r = await listCmd.ExecuteReaderAsync(ct);
            while (await r.ReadAsync(ct))
            {
                items.Add(new ShiftHandoverSummaryDto(
                    HandoverId: r.GetGuid(0),
                    LotId: r.GetGuid(1),
                    SenderShiftId: r.GetGuid(2),
                    ReceiverShiftId: r.GetGuid(3),
                    SenderUserId: r.GetGuid(4),
                    ReceiverUserId: r.GetGuid(5),
                    Status: r.GetString(6),
                    CreatedAt: r.GetFieldValue<DateTimeOffset>(7),
                    ConfirmedAt: r.IsDBNull(8) ? null : r.GetFieldValue<DateTimeOffset>(8),
                    Version: r.GetInt32(9)
                ));
            }
        }

        return new PagedResult<ShiftHandoverSummaryDto>(items, page, pageSize, totalCount);
    }

    /// <summary>
    /// Đọc thông tin chi tiết biên bản bàn giao ca và xác minh quyền truy cập theo vai trò.
    /// </summary>
    public async Task<ShiftHandoverDto?> GetShiftHandoverByIdAsync(
        Guid lotId,
        Guid handoverId,
        Guid actorId,
        bool isManager,
        CancellationToken ct)
    {
        await using var conn = await db.OpenConnectionAsync(ct);
        await using var cmd = new NpgsqlCommand("""
            SELECT id, lot_id, sender_shift_id, receiver_shift_id, sender_user_id, receiver_user_id,
                   completed_tasks, unresolved_issues, pending_transactions, equipment_status, notes_for_next,
                   status, created_at, confirmed_at, confirmed_by_user_id, version
            FROM shift_handovers
            WHERE lot_id = @lotId AND id = @handoverId
            """, conn);
        cmd.Parameters.AddWithValue("lotId", lotId);
        cmd.Parameters.AddWithValue("handoverId", handoverId);

        await using var r = await cmd.ExecuteReaderAsync(ct);
        if (!await r.ReadAsync(ct)) return null;

        var senderUserId = r.GetGuid(4);
        var receiverUserId = r.GetGuid(5);

        if (!isManager && actorId != senderUserId && actorId != receiverUserId)
        {
            throw new ServiceException(403, "Bạn không có quyền xem biên bản bàn giao ca này.");
        }

        return new ShiftHandoverDto(
            HandoverId: r.GetGuid(0),
            LotId: r.GetGuid(1),
            SenderShiftId: r.GetGuid(2),
            ReceiverShiftId: r.GetGuid(3),
            SenderUserId: senderUserId,
            ReceiverUserId: receiverUserId,
            CompletedTasks: r.GetString(6),
            UnresolvedIssues: r.GetString(7),
            PendingTransactions: r.GetString(8),
            EquipmentStatus: r.IsDBNull(9) ? null : r.GetString(9),
            NotesForNext: r.GetString(10),
            Status: r.GetString(11),
            CreatedAt: r.GetFieldValue<DateTimeOffset>(12),
            ConfirmedAt: r.IsDBNull(13) ? null : r.GetFieldValue<DateTimeOffset>(13),
            ConfirmedByUserId: r.IsDBNull(14) ? null : r.GetGuid(14),
            Version: r.GetInt32(15)
        );
    }

    /// <summary>
    /// Nhân viên nhận ca xác nhận hoàn tất nhận ca (Handshake), khóa dòng FOR UPDATE và ghi lịch sử.
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

        Guid receiverUserId;
        string status;
        int version;
        Guid? confirmedBy;

        await using (var lockCmd = new NpgsqlCommand("""
            SELECT receiver_user_id, status, version, confirmed_by_user_id
            FROM shift_handovers
            WHERE lot_id = @lotId AND id = @handoverId
            FOR UPDATE
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

        if (string.Equals(status, "Confirmed", StringComparison.OrdinalIgnoreCase))
        {
            if (confirmedBy == actorId)
            {
                // Idempotent retry: return existing confirmed handover
                await tx.RollbackAsync(ct);
                return (await GetShiftHandoverByIdAsync(lotId, handoverId, actorId, isManager: true, ct))!;
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

        var now = clock.GetUtcNow();

        await using (var updateCmd = new NpgsqlCommand("""
            UPDATE shift_handovers
            SET status = 'Confirmed',
                confirmed_at = @now,
                confirmed_by_user_id = @actorId,
                version = version + 1
            WHERE lot_id = @lotId AND id = @handoverId
            """, conn, tx))
        {
            updateCmd.Parameters.AddWithValue("now", now);
            updateCmd.Parameters.AddWithValue("actorId", actorId);
            updateCmd.Parameters.AddWithValue("lotId", lotId);
            updateCmd.Parameters.AddWithValue("handoverId", handoverId);
            await updateCmd.ExecuteNonQueryAsync(ct);
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

        await tx.CommitAsync(ct);
        return (await GetShiftHandoverByIdAsync(lotId, handoverId, actorId, isManager: true, ct))!;
    }

    /// <summary>
    /// Quản lý chỉ định lại nhân viên nhận ca khi người cũ vắng mặt hoặc bị khóa, cập nhật version và lưu lịch sử.
    /// </summary>
    public async Task<ShiftHandoverDto> ReassignReceiverAsync(
        Guid lotId,
        Guid handoverId,
        Guid actorId,
        ReassignReceiverRequestDto request,
        CancellationToken ct)
    {
        if (request.ReceiverUserId == Guid.Empty)
            throw new ServiceException(400, "Valid receiverUserId is required.");
        if (string.IsNullOrWhiteSpace(request.Reason))
            throw new ServiceException(400, "Lý do thay đổi người nhận ca (reason) là bắt buộc.");

        await using var conn = await db.OpenConnectionAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);

        Guid senderUserId;
        Guid oldReceiverUserId;
        string status;
        int version;

        await using (var lockCmd = new NpgsqlCommand("""
            SELECT sender_user_id, receiver_user_id, status, version
            FROM shift_handovers
            WHERE lot_id = @lotId AND id = @handoverId
            FOR UPDATE
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
                version = version + 1
            WHERE lot_id = @lotId AND id = @handoverId
            """, conn, tx))
        {
            updateCmd.Parameters.AddWithValue("newReceiver", request.ReceiverUserId);
            updateCmd.Parameters.AddWithValue("lotId", lotId);
            updateCmd.Parameters.AddWithValue("handoverId", handoverId);
            await updateCmd.ExecuteNonQueryAsync(ct);
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
            histCmd.Parameters.AddWithValue("reason", request.Reason.Trim());
            histCmd.Parameters.AddWithValue("now", now);
            await histCmd.ExecuteNonQueryAsync(ct);
        }

        await tx.CommitAsync(ct);
        return (await GetShiftHandoverByIdAsync(lotId, handoverId, actorId, isManager: true, ct))!;
    }
}
