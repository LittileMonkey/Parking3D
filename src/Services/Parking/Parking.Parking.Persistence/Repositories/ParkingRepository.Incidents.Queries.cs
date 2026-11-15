using System.Text.Json;
using System.Text;
using Npgsql;
using Parking.Parking.Application.DTOs;
using Parking.ServiceDefaults;

namespace Parking.Parking.Persistence.Repositories;

public sealed partial class ParkingRepository
{
    /// <summary>
    /// Lấy danh sách tóm tắt các sự cố tại bãi đỗ xe theo bộ lọc trạng thái, mức độ nghiêm trọng và từ khóa tìm kiếm.
    /// </summary>
    public Task<PagedResult<IncidentSummaryDto>> ListIncidentsAsync(
        Guid lotId,
        string? status,
        string? severity,
        string? query,
        int page,
        int pageSize,
        CancellationToken ct)
        => ListIncidentsAsync(lotId, status, severity, query, null, null, page, pageSize, ct);

    /// <summary>
    /// Lấy danh sách tóm tắt các sự cố tại bãi đỗ xe theo bộ lọc trạng thái, mức độ nghiêm trọng, khoảng thời gian [from, to) và phân trang.
    /// </summary>
    public async Task<PagedResult<IncidentSummaryDto>> ListIncidentsAsync(
        Guid lotId,
        string? status,
        string? severity,
        string? query,
        DateTimeOffset? from,
        DateTimeOffset? to,
        int page,
        int pageSize,
        CancellationToken ct)
    {
        if (from.HasValue && to.HasValue && from.Value >= to.Value)
            throw new ServiceException(400, "Filter 'from' must be earlier than 'to'.");

        if (page < 1) page = 1;
        if (pageSize < 1) pageSize = 25;
        if (pageSize > 100) pageSize = 100;
        var offset = (page - 1) * pageSize;

        await using var conn = await db.OpenConnectionAsync(ct);

        var whereClause = new StringBuilder("WHERE lot_id = @lotId");
        var hasStatus = !string.IsNullOrWhiteSpace(status) && !string.Equals(status.Trim(), "All", StringComparison.OrdinalIgnoreCase);
        var hasSeverity = !string.IsNullOrWhiteSpace(severity) && !string.Equals(severity.Trim(), "All", StringComparison.OrdinalIgnoreCase);
        var hasQuery = !string.IsNullOrWhiteSpace(query);

        if (hasStatus)
            whereClause.Append(" AND LOWER(status) = LOWER(@status)");
        if (hasSeverity)
            whereClause.Append(" AND LOWER(severity) = LOWER(@severity)");
        if (from.HasValue)
            whereClause.Append(" AND detected_at >= @from");
        if (to.HasValue)
            whereClause.Append(" AND detected_at < @to");
        if (hasQuery)
            whereClause.Append(" AND (title ILIKE @query OR related_plate ILIKE @query OR related_slot_code ILIKE @query)");

        void BindFilterParameters(NpgsqlCommand cmd)
        {
            cmd.Parameters.AddWithValue("lotId", lotId);
            if (hasStatus)
                cmd.Parameters.AddWithValue("status", status!.Trim());
            if (hasSeverity)
                cmd.Parameters.AddWithValue("severity", severity!.Trim());
            if (from.HasValue)
                cmd.Parameters.AddWithValue("from", from.Value);
            if (to.HasValue)
                cmd.Parameters.AddWithValue("to", to.Value);
            if (hasQuery)
                cmd.Parameters.AddWithValue("query", $"%{query!.Trim()}%");
        }

        var countSql = $"SELECT COUNT(*) FROM parking_issues {whereClause}";
        int totalCount;
        await using (var countCmd = new NpgsqlCommand(countSql, conn))
        {
            BindFilterParameters(countCmd);
            totalCount = Convert.ToInt32(await countCmd.ExecuteScalarAsync(ct));
        }

        var listSql = $"""
            SELECT id, lot_id, title, issue_type, severity, status, related_plate, related_slot_code,
                   created_at, updated_at, version
            FROM parking_issues
            {whereClause}
            ORDER BY detected_at DESC, id DESC
            LIMIT @limit OFFSET @offset
            """;

        var items = new List<IncidentSummaryDto>();
        await using (var listCmd = new NpgsqlCommand(listSql, conn))
        {
            BindFilterParameters(listCmd);
            listCmd.Parameters.AddWithValue("limit", pageSize);
            listCmd.Parameters.AddWithValue("offset", offset);

            await using var r = await listCmd.ExecuteReaderAsync(ct);
            while (await r.ReadAsync(ct))
            {
                items.Add(new IncidentSummaryDto(
                    IncidentId: r.GetGuid(0),
                    LotId: r.GetGuid(1),
                    Title: r.GetString(2),
                    Type: r.GetString(3),
                    Severity: r.GetString(4),
                    Status: r.GetString(5),
                    RelatedPlate: r.IsDBNull(6) ? null : r.GetString(6),
                    RelatedSlotCode: r.IsDBNull(7) ? null : r.GetString(7),
                    ReportedAt: r.GetFieldValue<DateTimeOffset>(8),
                    UpdatedAt: r.GetFieldValue<DateTimeOffset>(9),
                    Version: r.GetInt32(10)
                ));
            }
        }

        return new PagedResult<IncidentSummaryDto>(items, page, pageSize, totalCount);
    }

    /// <summary>
    /// Lấy đầy đủ thông tin chi tiết của một sự cố bao gồm chứng cứ đính kèm và quyết định ngoại lệ.
    /// </summary>
    public async Task<IncidentDto?> GetIncidentByIdAsync(Guid lotId, Guid incidentId, CancellationToken ct)
    {
        await using var conn = await db.OpenConnectionAsync(ct);
        return await ReadIncidentByIdAsync(conn, null, lotId, incidentId, ct);
    }

    private static async Task<IncidentDto?> ReadIncidentByIdAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction? tx,
        Guid lotId,
        Guid incidentId,
        CancellationToken ct)
    {
        await using var cmd = new NpgsqlCommand("""
            SELECT id, lot_id, title, issue_type, severity, description, status, reported_by,
                   detected_at, created_at, updated_at, resolved_at, late_report_reason,
                   related_plate, related_slot_code, related_gate, booking_id, session_id,
                   evidence, exit_decision, version
            FROM parking_issues
            WHERE lot_id = @lotId AND id = @incidentId
            """, conn, tx);
        cmd.Parameters.AddWithValue("lotId", lotId);
        cmd.Parameters.AddWithValue("incidentId", incidentId);

        await using var r = await cmd.ExecuteReaderAsync(ct);
        if (!await r.ReadAsync(ct)) return null;

        var evidenceJson = r.IsDBNull(18) ? "[]" : r.GetString(18);
        var evidenceList = JsonSerializer.Deserialize<List<IncidentEvidenceDto>>(evidenceJson, JsonOptions)
                           ?? new List<IncidentEvidenceDto>();

        IncidentExitDecisionDto? exitDecision = null;
        if (!r.IsDBNull(19))
        {
            var decisionJson = r.GetString(19);
            exitDecision = JsonSerializer.Deserialize<IncidentExitDecisionDto>(decisionJson, JsonOptions);
        }

        return new IncidentDto(
            IncidentId: r.GetGuid(0),
            LotId: r.GetGuid(1),
            Title: r.GetString(2),
            Type: r.GetString(3),
            Severity: r.GetString(4),
            Description: r.GetString(5),
            Status: r.GetString(6),
            ReportedByUserId: r.IsDBNull(7) ? null : r.GetGuid(7),
            DetectedAt: r.GetFieldValue<DateTimeOffset>(8),
            ReportedAt: r.GetFieldValue<DateTimeOffset>(9),
            UpdatedAt: r.GetFieldValue<DateTimeOffset>(10),
            ResolvedAt: r.IsDBNull(11) ? null : r.GetFieldValue<DateTimeOffset>(11),
            LateReportReason: r.IsDBNull(12) ? null : r.GetString(12),
            RelatedPlate: r.IsDBNull(13) ? null : r.GetString(13),
            RelatedSlotCode: r.IsDBNull(14) ? null : r.GetString(14),
            RelatedGate: r.IsDBNull(15) ? null : r.GetString(15),
            RelatedBookingId: r.IsDBNull(16) ? null : r.GetGuid(16),
            RelatedSessionId: r.IsDBNull(17) ? null : r.GetGuid(17),
            Evidence: evidenceList,
            ExitDecision: exitDecision,
            Version: r.GetInt32(20)
        );
    }

    /// <summary>
    /// Lấy danh sách lịch sử chuyển đổi trạng thái và hành động xử lý của một sự cố.
    /// </summary>
    public async Task<PagedResult<IncidentHistoryItemDto>> GetIncidentHistoryAsync(
        Guid lotId,
        Guid incidentId,
        int page,
        int pageSize,
        CancellationToken ct)
    {
        if (page < 1) page = 1;
        if (pageSize < 1) pageSize = 25;
        if (pageSize > 100) pageSize = 100;
        var offset = (page - 1) * pageSize;

        await using var conn = await db.OpenConnectionAsync(ct);

        await using (var existsCmd = new NpgsqlCommand("SELECT EXISTS(SELECT 1 FROM parking_issues WHERE lot_id = @lotId AND id = @incidentId)", conn))
        {
            existsCmd.Parameters.AddWithValue("lotId", lotId);
            existsCmd.Parameters.AddWithValue("incidentId", incidentId);
            var exists = (bool)(await existsCmd.ExecuteScalarAsync(ct))!;
            if (!exists) throw new ServiceException(404, "Sự cố không tồn tại.");
        }

        int totalCount;
        await using (var countCmd = new NpgsqlCommand("SELECT COUNT(*) FROM incident_history WHERE lot_id = @lotId AND incident_id = @incidentId", conn))
        {
            countCmd.Parameters.AddWithValue("lotId", lotId);
            countCmd.Parameters.AddWithValue("incidentId", incidentId);
            totalCount = Convert.ToInt32(await countCmd.ExecuteScalarAsync(ct));
        }

        var items = new List<IncidentHistoryItemDto>();
        await using (var cmd = new NpgsqlCommand("""
            SELECT id, incident_id, action, from_status, to_status, performed_by_user_id, performed_at, reason
            FROM incident_history
            WHERE lot_id = @lotId AND incident_id = @incidentId
            ORDER BY performed_at DESC
            LIMIT @limit OFFSET @offset
            """, conn))
        {
            cmd.Parameters.AddWithValue("lotId", lotId);
            cmd.Parameters.AddWithValue("incidentId", incidentId);
            cmd.Parameters.AddWithValue("limit", pageSize);
            cmd.Parameters.AddWithValue("offset", offset);

            await using var r = await cmd.ExecuteReaderAsync(ct);
            while (await r.ReadAsync(ct))
            {
                items.Add(new IncidentHistoryItemDto(
                    Id: r.GetGuid(0),
                    IncidentId: r.GetGuid(1),
                    Action: r.GetString(2),
                    FromStatus: r.IsDBNull(3) ? null : r.GetString(3),
                    ToStatus: r.IsDBNull(4) ? null : r.GetString(4),
                    PerformedByUserId: r.GetGuid(5),
                    PerformedAt: r.GetFieldValue<DateTimeOffset>(6),
                    Reason: r.IsDBNull(7) ? null : r.GetString(7)
                ));
            }
        }

        return new PagedResult<IncidentHistoryItemDto>(items, page, pageSize, totalCount);
    }
}
