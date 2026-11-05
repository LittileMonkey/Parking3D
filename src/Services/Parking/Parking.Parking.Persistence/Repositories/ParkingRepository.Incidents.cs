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
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    /// <summary>
    /// Ghi nhận sự cố mới: kiểm tra thời điểm phát hiện, khóa advisory lock và lưu outcome vào integration_inbox.
    /// </summary>
    public async Task<IncidentDto> CreateIncidentAsync(
        Guid lotId,
        Guid actorId,
        CreateIncidentRequestDto request,
        string? key,
        CancellationToken ct)
    {
        if (lotId == Guid.Empty) throw new ServiceException(400, "Valid lotId is required.");
        if (string.IsNullOrWhiteSpace(request.Title) || request.Title.Length > 200)
            throw new ServiceException(400, "Title is required and must not exceed 200 characters.");
        if (string.IsNullOrWhiteSpace(request.Type) || request.Type.Length > 64)
            throw new ServiceException(400, "Type is required and must not exceed 64 characters.");
        if (string.IsNullOrWhiteSpace(request.Description) || request.Description.Length > 4000)
            throw new ServiceException(400, "Description is required and must not exceed 4000 characters.");

        var validSeverities = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "Low", "Medium", "High", "Critical" };
        if (!validSeverities.Contains(request.Severity))
            throw new ServiceException(400, "Severity must be one of: Low, Medium, High, Critical.");

        var now = clock.GetUtcNow();
        if (now - request.DetectedAt > TimeSpan.FromMinutes(10) && string.IsNullOrWhiteSpace(request.LateReportReason))
        {
            throw new ServiceException(400, "Lý do báo muộn (lateReportReason) là bắt buộc khi báo sự cố muộn hơn 10 phút tính từ thời điểm phát hiện.");
        }

        await using var conn = await db.OpenConnectionAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);

        // Idempotency check via integration_inbox
        Guid? requestId = null;
        string? fingerprint = null;
        if (!string.IsNullOrWhiteSpace(key))
        {
            if (key.Length > 128) throw new ServiceException(400, "Idempotency-Key must not exceed 128 characters.");
            requestId = new Guid(SHA256.HashData(Encoding.UTF8.GetBytes(actorId + ":incident:" + key)).AsSpan(0, 16));
            fingerprint = Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(request, JsonOptions))));

            await using var lockCmd = new NpgsqlCommand("SELECT pg_advisory_xact_lock(hashtextextended(@key,0))", conn, tx);
            lockCmd.Parameters.AddWithValue("key", actorId + ":incident:" + key);
            await lockCmd.ExecuteNonQueryAsync(ct);

            await using var inboxCmd = new NpgsqlCommand("SELECT payload_hash, outcome FROM integration_inbox WHERE event_id=@id AND event_type='CreateIncident'", conn, tx);
            inboxCmd.Parameters.AddWithValue("id", requestId.Value);
            await using var r = await inboxCmd.ExecuteReaderAsync(ct);
            if (await r.ReadAsync(ct))
            {
                if (r.GetString(0) != fingerprint)
                    throw new ServiceException(409, "Idempotency key reused for a different incident payload.");
                return JsonSerializer.Deserialize<IncidentDto>(r.GetString(1), JsonOptions)!;
            }
        }

        var incidentId = Guid.NewGuid();
        var evidenceList = request.Evidence ?? (IReadOnlyList<IncidentEvidenceDto>)Array.Empty<IncidentEvidenceDto>();
        var evidenceJson = JsonSerializer.Serialize(evidenceList, JsonOptions);

        await using (var insertCmd = new NpgsqlCommand("""
            INSERT INTO parking_issues (
                id, lot_id, session_id, booking_id, issue_type, status, reason, reported_by,
                title, severity, description, detected_at, late_report_reason,
                related_plate, related_slot_code, related_gate, evidence, exit_decision, version,
                created_at, updated_at
            ) VALUES (
                @id, @lotId, @sessionId, @bookingId, @issueType, 'Open', @reason, @reportedBy,
                @title, @severity, @description, @detectedAt, @lateReportReason,
                @relatedPlate, @relatedSlotCode, @relatedGate, @evidence::jsonb, NULL, 1,
                @now, @now
            )
            """, conn, tx))
        {
            insertCmd.Parameters.AddWithValue("id", incidentId);
            insertCmd.Parameters.AddWithValue("lotId", lotId);
            insertCmd.Parameters.Add("sessionId", NpgsqlDbType.Uuid).Value = (object?)request.RelatedSessionId ?? DBNull.Value;
            insertCmd.Parameters.Add("bookingId", NpgsqlDbType.Uuid).Value = (object?)request.RelatedBookingId ?? DBNull.Value;
            insertCmd.Parameters.AddWithValue("issueType", request.Type);
            insertCmd.Parameters.AddWithValue("reason", request.Description);
            insertCmd.Parameters.AddWithValue("reportedBy", actorId);
            insertCmd.Parameters.AddWithValue("title", request.Title.Trim());
            insertCmd.Parameters.AddWithValue("severity", request.Severity);
            insertCmd.Parameters.AddWithValue("description", request.Description.Trim());
            insertCmd.Parameters.AddWithValue("detectedAt", request.DetectedAt);
            insertCmd.Parameters.Add("lateReportReason", NpgsqlDbType.Text).Value = (object?)request.LateReportReason ?? DBNull.Value;
            insertCmd.Parameters.Add("relatedPlate", NpgsqlDbType.Text).Value = (object?)request.RelatedPlate ?? DBNull.Value;
            insertCmd.Parameters.Add("relatedSlotCode", NpgsqlDbType.Text).Value = (object?)request.RelatedSlotCode ?? DBNull.Value;
            insertCmd.Parameters.Add("relatedGate", NpgsqlDbType.Text).Value = (object?)request.RelatedGate ?? DBNull.Value;
            insertCmd.Parameters.AddWithValue("evidence", evidenceJson);
            insertCmd.Parameters.AddWithValue("now", now);
            await insertCmd.ExecuteNonQueryAsync(ct);
        }

        // Insert initial history
        await using (var historyCmd = new NpgsqlCommand("""
            INSERT INTO incident_history (
                id, incident_id, lot_id, action, from_status, to_status, performed_by_user_id, reason, performed_at
            ) VALUES (
                gen_random_uuid(), @incidentId, @lotId, 'CREATED', NULL, 'Open', @actorId, 'Báo cáo sự cố mới', @now
            )
            """, conn, tx))
        {
            historyCmd.Parameters.AddWithValue("incidentId", incidentId);
            historyCmd.Parameters.AddWithValue("lotId", lotId);
            historyCmd.Parameters.AddWithValue("actorId", actorId);
            historyCmd.Parameters.AddWithValue("now", now);
            await historyCmd.ExecuteNonQueryAsync(ct);
        }

        var result = new IncidentDto(
            IncidentId: incidentId,
            LotId: lotId,
            Title: request.Title.Trim(),
            Type: request.Type,
            Severity: request.Severity,
            Description: request.Description.Trim(),
            Status: "Open",
            ReportedByUserId: actorId,
            DetectedAt: request.DetectedAt,
            ReportedAt: now,
            UpdatedAt: now,
            ResolvedAt: null,
            LateReportReason: request.LateReportReason,
            RelatedPlate: request.RelatedPlate,
            RelatedSlotCode: request.RelatedSlotCode,
            RelatedGate: request.RelatedGate,
            RelatedBookingId: request.RelatedBookingId,
            RelatedSessionId: request.RelatedSessionId,
            Evidence: evidenceList,
            ExitDecision: null,
            Version: 1
        );

        if (requestId.HasValue && fingerprint is not null)
        {
            await using var saveInbox = new NpgsqlCommand("""
                INSERT INTO integration_inbox(event_id, event_type, payload_hash, outcome, received_at)
                VALUES (@id, 'CreateIncident', @hash, @outcome, @now)
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
    /// Lấy danh sách tóm tắt các sự cố tại bãi đỗ xe theo bộ lọc trạng thái, mức độ nghiêm trọng và từ khóa tìm kiếm.
    /// </summary>
    public async Task<PagedResult<IncidentSummaryDto>> ListIncidentsAsync(
        Guid lotId,
        string? status,
        string? severity,
        string? query,
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
        if (!string.IsNullOrWhiteSpace(status) && !string.Equals(status, "All", StringComparison.OrdinalIgnoreCase))
        {
            whereClause.Append(" AND status = @status");
        }
        if (!string.IsNullOrWhiteSpace(severity) && !string.Equals(severity, "All", StringComparison.OrdinalIgnoreCase))
        {
            whereClause.Append(" AND severity = @severity");
        }
        if (!string.IsNullOrWhiteSpace(query))
        {
            whereClause.Append(" AND (title ILIKE @query OR related_plate ILIKE @query OR related_slot_code ILIKE @query)");
        }

        var countSql = $"SELECT COUNT(*) FROM parking_issues {whereClause}";
        int totalCount;
        await using (var countCmd = new NpgsqlCommand(countSql, conn))
        {
            countCmd.Parameters.AddWithValue("lotId", lotId);
            if (!string.IsNullOrWhiteSpace(status) && !string.Equals(status, "All", StringComparison.OrdinalIgnoreCase))
                countCmd.Parameters.AddWithValue("status", status);
            if (!string.IsNullOrWhiteSpace(severity) && !string.Equals(severity, "All", StringComparison.OrdinalIgnoreCase))
                countCmd.Parameters.AddWithValue("severity", severity);
            if (!string.IsNullOrWhiteSpace(query))
                countCmd.Parameters.AddWithValue("query", $"%{query.Trim()}%");
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
            listCmd.Parameters.AddWithValue("lotId", lotId);
            if (!string.IsNullOrWhiteSpace(status) && !string.Equals(status, "All", StringComparison.OrdinalIgnoreCase))
                listCmd.Parameters.AddWithValue("status", status);
            if (!string.IsNullOrWhiteSpace(severity) && !string.Equals(severity, "All", StringComparison.OrdinalIgnoreCase))
                listCmd.Parameters.AddWithValue("severity", severity);
            if (!string.IsNullOrWhiteSpace(query))
                listCmd.Parameters.AddWithValue("query", $"%{query.Trim()}%");
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
        await using var cmd = new NpgsqlCommand("""
            SELECT id, lot_id, title, issue_type, severity, description, status, reported_by,
                   detected_at, created_at, updated_at, resolved_at, late_report_reason,
                   related_plate, related_slot_code, related_gate, booking_id, session_id,
                   evidence, exit_decision, version
            FROM parking_issues
            WHERE lot_id = @lotId AND id = @incidentId
            """, conn);
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
    /// Cập nhật tiến độ xử lý sự cố (InProgress/Escalated/Resolved) dưới khóa FOR UPDATE và kiểm tra expectedVersion.
    /// </summary>
    public async Task<IncidentDto> UpdateIncidentStatusAsync(
        Guid lotId,
        Guid incidentId,
        Guid actorId,
        UpdateIncidentStatusRequestDto request,
        CancellationToken ct)
    {
        var validStatuses = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "InProgress", "Escalated", "Resolved" };
        if (!validStatuses.Contains(request.Status))
            throw new ServiceException(400, "Status must be one of: InProgress, Escalated, Resolved.");

        await using var conn = await db.OpenConnectionAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);

        string currentStatus;
        int currentVersion;
        await using (var lockCmd = new NpgsqlCommand("""
            SELECT status, version FROM parking_issues
            WHERE lot_id = @lotId AND id = @incidentId
            FOR UPDATE
            """, conn, tx))
        {
            lockCmd.Parameters.AddWithValue("lotId", lotId);
            lockCmd.Parameters.AddWithValue("incidentId", incidentId);
            await using var r = await lockCmd.ExecuteReaderAsync(ct);
            if (!await r.ReadAsync(ct))
                throw new ServiceException(404, "Sự cố không tồn tại tại bãi đỗ xe này.");
            currentStatus = r.GetString(0);
            currentVersion = r.GetInt32(1);
        }

        if (string.Equals(currentStatus, "Cancelled", StringComparison.OrdinalIgnoreCase))
            throw new ServiceException(409, "Không thể cập nhật sự cố đã bị hủy bỏ (Cancelled).");

        if (currentVersion != request.ExpectedVersion)
            throw new ServiceException(409, $"Xung đột dữ liệu: Phiên bản hiện tại là {currentVersion}, yêu cầu của bạn dựa trên phiên bản {request.ExpectedVersion}. Vui lòng làm mới trang.");

        var now = clock.GetUtcNow();
        var isResolved = string.Equals(request.Status, "Resolved", StringComparison.OrdinalIgnoreCase);

        await using (var updateCmd = new NpgsqlCommand("""
            UPDATE parking_issues
            SET status = @newStatus,
                resolution = CASE WHEN @isResolved THEN coalesce(@notes, resolution) ELSE resolution END,
                resolved_at = CASE WHEN @isResolved THEN @now ELSE resolved_at END,
                version = version + 1,
                updated_at = @now
            WHERE lot_id = @lotId AND id = @incidentId
            """, conn, tx))
        {
            updateCmd.Parameters.AddWithValue("newStatus", request.Status);
            updateCmd.Parameters.AddWithValue("isResolved", isResolved);
            updateCmd.Parameters.Add("notes", NpgsqlDbType.Text).Value = (object?)request.Notes ?? DBNull.Value;
            updateCmd.Parameters.AddWithValue("now", now);
            updateCmd.Parameters.AddWithValue("lotId", lotId);
            updateCmd.Parameters.AddWithValue("incidentId", incidentId);
            await updateCmd.ExecuteNonQueryAsync(ct);
        }

        await using (var histCmd = new NpgsqlCommand("""
            INSERT INTO incident_history (
                id, incident_id, lot_id, action, from_status, to_status, performed_by_user_id, reason, performed_at
            ) VALUES (
                gen_random_uuid(), @incidentId, @lotId, 'STATUS_UPDATED', @fromStatus, @toStatus, @actorId, @reason, @now
            )
            """, conn, tx))
        {
            histCmd.Parameters.AddWithValue("incidentId", incidentId);
            histCmd.Parameters.AddWithValue("lotId", lotId);
            histCmd.Parameters.AddWithValue("fromStatus", currentStatus);
            histCmd.Parameters.AddWithValue("toStatus", request.Status);
            histCmd.Parameters.AddWithValue("actorId", actorId);
            histCmd.Parameters.Add("reason", NpgsqlDbType.Text).Value = (object?)request.Notes ?? DBNull.Value;
            histCmd.Parameters.AddWithValue("now", now);
            await histCmd.ExecuteNonQueryAsync(ct);
        }

        await tx.CommitAsync(ct);
        return (await GetIncidentByIdAsync(lotId, incidentId, ct))!;
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

    /// <summary>
    /// Quản lý mở lại sự cố từ trạng thái Resolved về Open kèm lý do ghi vết lịch sử.
    /// </summary>
    public async Task<IncidentDto> ReopenIncidentAsync(
        Guid lotId,
        Guid incidentId,
        Guid actorId,
        ReopenIncidentRequestDto request,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Reason))
            throw new ServiceException(400, "Lý do mở lại sự cố (reason) là bắt buộc.");

        await using var conn = await db.OpenConnectionAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);

        string currentStatus;
        int currentVersion;
        await using (var lockCmd = new NpgsqlCommand("""
            SELECT status, version FROM parking_issues
            WHERE lot_id = @lotId AND id = @incidentId
            FOR UPDATE
            """, conn, tx))
        {
            lockCmd.Parameters.AddWithValue("lotId", lotId);
            lockCmd.Parameters.AddWithValue("incidentId", incidentId);
            await using var r = await lockCmd.ExecuteReaderAsync(ct);
            if (!await r.ReadAsync(ct))
                throw new ServiceException(404, "Sự cố không tồn tại.");
            currentStatus = r.GetString(0);
            currentVersion = r.GetInt32(1);
        }

        if (!string.Equals(currentStatus, "Resolved", StringComparison.OrdinalIgnoreCase))
            throw new ServiceException(409, $"Chỉ có thể mở lại sự cố đã ở trạng thái Resolved. Trạng thái hiện tại: {currentStatus}.");

        if (currentVersion != request.ExpectedVersion)
            throw new ServiceException(409, $"Xung đột dữ liệu: Phiên bản hiện tại là {currentVersion}, mong muốn {request.ExpectedVersion}.");

        var now = clock.GetUtcNow();
        await using (var updateCmd = new NpgsqlCommand("""
            UPDATE parking_issues
            SET status = 'Open',
                resolved_at = NULL,
                version = version + 1,
                updated_at = @now
            WHERE lot_id = @lotId AND id = @incidentId
            """, conn, tx))
        {
            updateCmd.Parameters.AddWithValue("now", now);
            updateCmd.Parameters.AddWithValue("lotId", lotId);
            updateCmd.Parameters.AddWithValue("incidentId", incidentId);
            await updateCmd.ExecuteNonQueryAsync(ct);
        }

        await using (var histCmd = new NpgsqlCommand("""
            INSERT INTO incident_history (
                id, incident_id, lot_id, action, from_status, to_status, performed_by_user_id, reason, performed_at
            ) VALUES (
                gen_random_uuid(), @incidentId, @lotId, 'REOPENED', 'Resolved', 'Open', @actorId, @reason, @now
            )
            """, conn, tx))
        {
            histCmd.Parameters.AddWithValue("incidentId", incidentId);
            histCmd.Parameters.AddWithValue("lotId", lotId);
            histCmd.Parameters.AddWithValue("actorId", actorId);
            histCmd.Parameters.AddWithValue("reason", request.Reason.Trim());
            histCmd.Parameters.AddWithValue("now", now);
            await histCmd.ExecuteNonQueryAsync(ct);
        }

        await tx.CommitAsync(ct);
        return (await GetIncidentByIdAsync(lotId, incidentId, ct))!;
    }

    /// <summary>
    /// Hủy sự cố (báo nhầm) và cập nhật trạng thái Cancelled kèm lý do trong lịch sử.
    /// </summary>
    public async Task<IncidentDto> CancelIncidentAsync(
        Guid lotId,
        Guid incidentId,
        Guid actorId,
        CancelIncidentRequestDto request,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Reason))
            throw new ServiceException(400, "Lý do hủy báo cáo sự cố (reason) là bắt buộc.");

        await using var conn = await db.OpenConnectionAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);

        string currentStatus;
        int currentVersion;
        await using (var lockCmd = new NpgsqlCommand("""
            SELECT status, version FROM parking_issues
            WHERE lot_id = @lotId AND id = @incidentId
            FOR UPDATE
            """, conn, tx))
        {
            lockCmd.Parameters.AddWithValue("lotId", lotId);
            lockCmd.Parameters.AddWithValue("incidentId", incidentId);
            await using var r = await lockCmd.ExecuteReaderAsync(ct);
            if (!await r.ReadAsync(ct))
                throw new ServiceException(404, "Sự cố không tồn tại.");
            currentStatus = r.GetString(0);
            currentVersion = r.GetInt32(1);
        }

        if (string.Equals(currentStatus, "Cancelled", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(currentStatus, "Resolved", StringComparison.OrdinalIgnoreCase))
        {
            throw new ServiceException(409, $"Không thể hủy sự cố đang ở trạng thái {currentStatus}.");
        }

        if (currentVersion != request.ExpectedVersion)
            throw new ServiceException(409, $"Xung đột dữ liệu: Phiên bản hiện tại là {currentVersion}, mong muốn {request.ExpectedVersion}.");

        var now = clock.GetUtcNow();
        await using (var updateCmd = new NpgsqlCommand("""
            UPDATE parking_issues
            SET status = 'Cancelled',
                version = version + 1,
                updated_at = @now
            WHERE lot_id = @lotId AND id = @incidentId
            """, conn, tx))
        {
            updateCmd.Parameters.AddWithValue("now", now);
            updateCmd.Parameters.AddWithValue("lotId", lotId);
            updateCmd.Parameters.AddWithValue("incidentId", incidentId);
            await updateCmd.ExecuteNonQueryAsync(ct);
        }

        await using (var histCmd = new NpgsqlCommand("""
            INSERT INTO incident_history (
                id, incident_id, lot_id, action, from_status, to_status, performed_by_user_id, reason, performed_at
            ) VALUES (
                gen_random_uuid(), @incidentId, @lotId, 'CANCELLED', @fromStatus, 'Cancelled', @actorId, @reason, @now
            )
            """, conn, tx))
        {
            histCmd.Parameters.AddWithValue("incidentId", incidentId);
            histCmd.Parameters.AddWithValue("lotId", lotId);
            histCmd.Parameters.AddWithValue("fromStatus", currentStatus);
            histCmd.Parameters.AddWithValue("actorId", actorId);
            histCmd.Parameters.AddWithValue("reason", request.Reason.Trim());
            histCmd.Parameters.AddWithValue("now", now);
            await histCmd.ExecuteNonQueryAsync(ct);
        }

        await tx.CommitAsync(ct);
        return (await GetIncidentByIdAsync(lotId, incidentId, ct))!;
    }

    /// <summary>
    /// Ban hành quyết định xử lý ngoại lệ xuất bãi (Approved/Rejected) kèm chứng cứ đối chiếu và tăng version.
    /// </summary>
    public async Task<IncidentExitDecisionDto> CreateIncidentDecisionAsync(
        Guid lotId,
        Guid incidentId,
        Guid actorId,
        CreateIncidentDecisionRequestDto request,
        CancellationToken ct)
    {
        var validDecisions = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "Approved", "Rejected" };
        if (!validDecisions.Contains(request.Decision))
            throw new ServiceException(400, "Decision must be either 'Approved' or 'Rejected'.");
        if (string.IsNullOrWhiteSpace(request.Reason))
            throw new ServiceException(400, "Reason is required for incident decision.");

        var isApproved = string.Equals(request.Decision, "Approved", StringComparison.OrdinalIgnoreCase);
        if (isApproved && (request.Evidence is null || request.Evidence.Count == 0))
        {
            throw new ServiceException(400, "Quyết định phê duyệt ngoại lệ (Approved) bắt buộc phải có chứng cứ kèm theo (camera, giấy tờ xe).");
        }

        await using var conn = await db.OpenConnectionAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);

        int currentVersion;
        await using (var lockCmd = new NpgsqlCommand("""
            SELECT version FROM parking_issues
            WHERE lot_id = @lotId AND id = @incidentId
            FOR UPDATE
            """, conn, tx))
        {
            lockCmd.Parameters.AddWithValue("lotId", lotId);
            lockCmd.Parameters.AddWithValue("incidentId", incidentId);
            await using var r = await lockCmd.ExecuteReaderAsync(ct);
            if (!await r.ReadAsync(ct))
                throw new ServiceException(404, "Sự cố không tồn tại.");
            currentVersion = r.GetInt32(0);
        }

        if (currentVersion != request.ExpectedVersion)
            throw new ServiceException(409, $"Xung đột dữ liệu: Phiên bản hiện tại là {currentVersion}, mong muốn {request.ExpectedVersion}.");

        var now = clock.GetUtcNow();
        var newVersion = currentVersion + 1;
        var decisionId = Guid.NewGuid();
        var evidenceList = request.Evidence ?? (IReadOnlyList<IncidentEvidenceDto>)Array.Empty<IncidentEvidenceDto>();

        var decisionDto = new IncidentExitDecisionDto(
            DecisionId: decisionId,
            IncidentId: incidentId,
            Decision: request.Decision,
            Reason: request.Reason.Trim(),
            DecidedByUserId: actorId,
            DecidedAt: now,
            Evidence: evidenceList,
            NewVersion: newVersion
        );

        var decisionJson = JsonSerializer.Serialize(decisionDto, JsonOptions);

        await using (var updateCmd = new NpgsqlCommand("""
            UPDATE parking_issues
            SET exit_decision = @decision::jsonb,
                version = version + 1,
                updated_at = @now
            WHERE lot_id = @lotId AND id = @incidentId
            """, conn, tx))
        {
            updateCmd.Parameters.AddWithValue("decision", decisionJson);
            updateCmd.Parameters.AddWithValue("now", now);
            updateCmd.Parameters.AddWithValue("lotId", lotId);
            updateCmd.Parameters.AddWithValue("incidentId", incidentId);
            await updateCmd.ExecuteNonQueryAsync(ct);
        }

        await using (var histCmd = new NpgsqlCommand("""
            INSERT INTO incident_history (
                id, incident_id, lot_id, action, from_status, to_status, performed_by_user_id, reason, performed_at
            ) VALUES (
                gen_random_uuid(), @incidentId, @lotId, @action, NULL, NULL, @actorId, @reason, @now
            )
            """, conn, tx))
        {
            histCmd.Parameters.AddWithValue("incidentId", incidentId);
            histCmd.Parameters.AddWithValue("lotId", lotId);
            histCmd.Parameters.AddWithValue("action", $"DECISION_{request.Decision.ToUpperInvariant()}");
            histCmd.Parameters.AddWithValue("actorId", actorId);
            histCmd.Parameters.AddWithValue("reason", request.Reason.Trim());
            histCmd.Parameters.AddWithValue("now", now);
            await histCmd.ExecuteNonQueryAsync(ct);
        }

        await tx.CommitAsync(ct);
        return decisionDto;
    }
}
