using System.Text;
using Npgsql;
using Parking.Parking.Application.DTOs;
using Parking.ServiceDefaults;

namespace Parking.Parking.Persistence.Repositories;

public sealed partial class ParkingRepository
{
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
        return await ReadShiftHandoverByIdAsync(conn, null, lotId, handoverId, actorId, isManager, ct);
    }

    private static async Task<ShiftHandoverDto?> ReadShiftHandoverByIdAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction? tx,
        Guid lotId,
        Guid handoverId,
        Guid actorId,
        bool isManager,
        CancellationToken ct)
    {
        await using var cmd = new NpgsqlCommand("""
            SELECT id, lot_id, sender_shift_id, receiver_shift_id, sender_user_id, receiver_user_id,
                   completed_tasks, unresolved_issues, pending_transactions, equipment_status, notes_for_next,
                   status, created_at, confirmed_at, confirmed_by_user_id, version
            FROM shift_handovers
            WHERE lot_id = @lotId AND id = @handoverId
            """, conn, tx);
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
    /// Lấy lịch sử thao tác trên biên bản bàn giao ca (tạo mới, xác nhận, chỉ định lại người nhận).
    /// </summary>
    public async Task<PagedResult<ShiftHandoverHistoryItemDto>> GetShiftHandoverHistoryAsync(
        Guid lotId,
        Guid handoverId,
        Guid actorId,
        bool isManager,
        int page,
        int pageSize,
        CancellationToken ct)
    {
        if (page < 1) page = 1;
        if (pageSize < 1) pageSize = 25;
        if (pageSize > 100) pageSize = 100;
        var offset = (page - 1) * pageSize;

        await using var conn = await db.OpenConnectionAsync(ct);

        await using (var ownerCmd = new NpgsqlCommand("""
            SELECT sender_user_id, receiver_user_id
            FROM shift_handovers
            WHERE lot_id = @lotId AND id = @handoverId
            """, conn))
        {
            ownerCmd.Parameters.AddWithValue("lotId", lotId);
            ownerCmd.Parameters.AddWithValue("handoverId", handoverId);
            await using var ownerReader = await ownerCmd.ExecuteReaderAsync(ct);
            if (!await ownerReader.ReadAsync(ct))
                throw new ServiceException(404, "Biên bản bàn giao ca không tồn tại.");

            var senderUserId = ownerReader.GetGuid(0);
            var receiverUserId = ownerReader.GetGuid(1);
            if (!isManager && actorId != senderUserId && actorId != receiverUserId)
                throw new ServiceException(403, "Bạn không có quyền xem lịch sử bàn giao ca này.");
        }

        int totalCount;
        await using (var countCmd = new NpgsqlCommand("""
            SELECT COUNT(*)
            FROM shift_handover_history
            WHERE lot_id = @lotId AND handover_id = @handoverId
            """, conn))
        {
            countCmd.Parameters.AddWithValue("lotId", lotId);
            countCmd.Parameters.AddWithValue("handoverId", handoverId);
            totalCount = Convert.ToInt32(await countCmd.ExecuteScalarAsync(ct));
        }

        var items = new List<ShiftHandoverHistoryItemDto>();
        await using (var listCmd = new NpgsqlCommand("""
            SELECT id, handover_id, lot_id, action, old_receiver_user_id, new_receiver_user_id,
                   performed_by_user_id, reason, performed_at
            FROM shift_handover_history
            WHERE lot_id = @lotId AND handover_id = @handoverId
            ORDER BY performed_at DESC, id DESC
            LIMIT @limit OFFSET @offset
            """, conn))
        {
            listCmd.Parameters.AddWithValue("lotId", lotId);
            listCmd.Parameters.AddWithValue("handoverId", handoverId);
            listCmd.Parameters.AddWithValue("limit", pageSize);
            listCmd.Parameters.AddWithValue("offset", offset);

            await using var r = await listCmd.ExecuteReaderAsync(ct);
            while (await r.ReadAsync(ct))
            {
                items.Add(new ShiftHandoverHistoryItemDto(
                    Id: r.GetGuid(0),
                    HandoverId: r.GetGuid(1),
                    LotId: r.GetGuid(2),
                    Action: r.GetString(3),
                    OldReceiverUserId: r.IsDBNull(4) ? null : r.GetGuid(4),
                    NewReceiverUserId: r.IsDBNull(5) ? null : r.GetGuid(5),
                    PerformedByUserId: r.GetGuid(6),
                    Reason: r.IsDBNull(7) ? null : r.GetString(7),
                    PerformedAt: r.GetFieldValue<DateTimeOffset>(8)
                ));
            }
        }

        return new PagedResult<ShiftHandoverHistoryItemDto>(items, page, pageSize, totalCount);
    }
}
