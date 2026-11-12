using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Npgsql;
using NpgsqlTypes;
using Parking.Parking.Application.DTOs;
using Parking.Parking.Application.Features.Incidents;
using Parking.ServiceDefaults;

namespace Parking.Parking.Persistence.Repositories;

public sealed partial class ParkingRepository
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    private static readonly Dictionary<string, string> CanonicalIncidentSeverities = new(StringComparer.OrdinalIgnoreCase)
    {
        ["Low"] = "Low",
        ["Medium"] = "Medium",
        ["High"] = "High",
        ["Critical"] = "Critical"
    };

    private static readonly Dictionary<string, string> CanonicalIncidentTargetStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        ["InProgress"] = "InProgress",
        ["Escalated"] = "Escalated",
        ["Resolved"] = "Resolved"
    };

    private static readonly Dictionary<string, HashSet<string>> AllowedIncidentTransitions = new(StringComparer.OrdinalIgnoreCase)
    {
        ["Open"] = new(StringComparer.OrdinalIgnoreCase) { "InProgress", "Escalated", "Resolved" },
        ["InProgress"] = new(StringComparer.OrdinalIgnoreCase) { "Escalated", "Resolved" },
        ["Escalated"] = new(StringComparer.OrdinalIgnoreCase) { "InProgress", "Resolved" }
    };

    private static async Task<(bool Replayed, T? Outcome, Guid? RequestId, string? Fingerprint)> TryReplayScrum99InboxAsync<T>(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        string scopePrefix,
        string eventType,
        object payloadForHash,
        string? key,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(key))
            return (false, default, null, null);

        var trimmedKey = key.Trim();
        if (trimmedKey.Length > 128)
            throw new ServiceException(400, "Idempotency-Key must not exceed 128 characters.");

        var scopeKey = $"{scopePrefix}:{trimmedKey}";
        var requestId = new Guid(SHA256.HashData(Encoding.UTF8.GetBytes(scopeKey)).AsSpan(0, 16));
        var fingerprint = Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(
            JsonSerializer.Serialize(payloadForHash, JsonOptions))));

        await using (var lockCmd = new NpgsqlCommand("SELECT pg_advisory_xact_lock(hashtextextended(@key,0))", conn, tx))
        {
            lockCmd.Parameters.AddWithValue("key", scopeKey);
            await lockCmd.ExecuteNonQueryAsync(ct);
        }

        await using var inboxCmd = new NpgsqlCommand(
            "SELECT event_type, payload_hash, outcome FROM integration_inbox WHERE event_id = @id", conn, tx);
        inboxCmd.Parameters.AddWithValue("id", requestId);
        await using var reader = await inboxCmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct))
            return (false, default, requestId, fingerprint);

        if (reader.GetString(0) != eventType || reader.GetString(1) != fingerprint)
            throw new ServiceException(409, "Idempotency key reused for a different request payload.");

        return (true, JsonSerializer.Deserialize<T>(reader.GetString(2), JsonOptions), requestId, fingerprint);
    }

    private static async Task SaveScrum99InboxAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        Guid? requestId,
        string eventType,
        string? fingerprint,
        object outcome,
        DateTimeOffset now,
        CancellationToken ct)
    {
        if (!requestId.HasValue || fingerprint is null)
            return;

        await using var saveInbox = new NpgsqlCommand("""
            INSERT INTO integration_inbox(event_id, event_type, payload_hash, outcome, received_at)
            VALUES (@id, @eventType, @hash, @outcome, @now)
            ON CONFLICT (event_id) DO NOTHING
            """, conn, tx);
        saveInbox.Parameters.AddWithValue("id", requestId.Value);
        saveInbox.Parameters.AddWithValue("eventType", eventType);
        saveInbox.Parameters.AddWithValue("hash", fingerprint);
        saveInbox.Parameters.AddWithValue("outcome", JsonSerializer.Serialize(outcome, JsonOptions));
        saveInbox.Parameters.AddWithValue("now", now);
        await saveInbox.ExecuteNonQueryAsync(ct);
    }

    private static async Task AppendScrum99AuditLogAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction tx,
        Guid lotId,
        Guid actorId,
        string action,
        string entityType,
        string entityId,
        string? reason,
        string? requestId,
        object? oldValues,
        object? newValues,
        DateTimeOffset now,
        CancellationToken ct)
    {
        await using var auditCmd = new NpgsqlCommand("""
            INSERT INTO audit_logs (
                id, lot_id, actor_user_id, actor_type, action, entity_type, entity_id,
                reason, request_id, old_values, new_values, created_at
            ) VALUES (
                gen_random_uuid(), @lotId, @actorId, 'STAFF', @action, @entityType, @entityId,
                @reason, @requestId, @oldValues, @newValues, @now
            )
            """, conn, tx);
        auditCmd.Parameters.AddWithValue("lotId", lotId);
        auditCmd.Parameters.AddWithValue("actorId", actorId);
        auditCmd.Parameters.AddWithValue("action", action);
        auditCmd.Parameters.AddWithValue("entityType", entityType);
        auditCmd.Parameters.AddWithValue("entityId", entityId);
        auditCmd.Parameters.Add("reason", NpgsqlDbType.Text).Value = (object?)reason ?? DBNull.Value;
        auditCmd.Parameters.Add("requestId", NpgsqlDbType.Text).Value = (object?)requestId ?? DBNull.Value;
        auditCmd.Parameters.Add("oldValues", NpgsqlDbType.Jsonb).Value =
            oldValues is null ? DBNull.Value : JsonSerializer.Serialize(oldValues, JsonOptions);
        auditCmd.Parameters.Add("newValues", NpgsqlDbType.Jsonb).Value =
            newValues is null ? DBNull.Value : JsonSerializer.Serialize(newValues, JsonOptions);
        auditCmd.Parameters.AddWithValue("now", now);
        await auditCmd.ExecuteNonQueryAsync(ct);
    }

    /// <summary>
    /// Ghi nhận sự cố mới: kiểm tra thời điểm phát hiện, khóa advisory lock, audit log và lưu outcome vào integration_inbox.
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

        if (!CanonicalIncidentSeverities.TryGetValue(request.Severity.Trim(), out var severity))
            throw new ServiceException(400, "Severity must be one of: Low, Medium, High, Critical.");

        var evidenceList = request.Evidence ?? (IReadOnlyList<IncidentEvidenceDto>)Array.Empty<IncidentEvidenceDto>();
        if (!IncidentEvidenceRules.AreAllItemsValid(evidenceList))
            throw new ServiceException(400, "Each evidence item must specify a valid kind and a safe non-base64 reference (max 2048 chars).");

        var now = clock.GetUtcNow();
        if (request.DetectedAt > now.AddMinutes(5))
            throw new ServiceException(400, "DetectedAt cannot be more than 5 minutes in the future.");
        if (now - request.DetectedAt > TimeSpan.FromMinutes(10) && string.IsNullOrWhiteSpace(request.LateReportReason))
        {
            throw new ServiceException(400, "Lý do báo muộn (lateReportReason) là bắt buộc khi báo sự cố muộn hơn 10 phút tính từ thời điểm phát hiện.");
        }

        await using var conn = await db.OpenConnectionAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);

        var (replayed, existingOutcome, requestId, fingerprint) = await TryReplayScrum99InboxAsync<IncidentDto>(
            conn, tx, $"CreateIncident:{lotId}:{actorId}", "CreateIncident", request, key, ct);
        if (replayed)
        {
            await tx.CommitAsync(ct);
            return existingOutcome!;
        }

        if (request.RelatedBookingId.HasValue)
        {
            await using var bookingCheck = new NpgsqlCommand(
                "SELECT EXISTS(SELECT 1 FROM bookings WHERE id = @bookingId AND lot_id = @lotId)", conn, tx);
            bookingCheck.Parameters.AddWithValue("bookingId", request.RelatedBookingId.Value);
            bookingCheck.Parameters.AddWithValue("lotId", lotId);
            if (!(bool)(await bookingCheck.ExecuteScalarAsync(ct))!)
                throw new ServiceException(404, "Related booking does not exist in this parking lot.");
        }

        if (request.RelatedSessionId.HasValue)
        {
            await using var sessionCheck = new NpgsqlCommand(
                "SELECT EXISTS(SELECT 1 FROM parking_sessions WHERE id = @sessionId AND lot_id = @lotId)", conn, tx);
            sessionCheck.Parameters.AddWithValue("sessionId", request.RelatedSessionId.Value);
            sessionCheck.Parameters.AddWithValue("lotId", lotId);
            if (!(bool)(await sessionCheck.ExecuteScalarAsync(ct))!)
                throw new ServiceException(404, "Related parking session does not exist in this parking lot.");
        }

        var incidentId = Guid.NewGuid();
        var evidenceJson = JsonSerializer.Serialize(evidenceList, JsonOptions);
        await ValidateStoredEvidenceAsync(conn, tx, lotId, evidenceList, ct);

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
            insertCmd.Parameters.AddWithValue("issueType", request.Type.Trim());
            insertCmd.Parameters.AddWithValue("reason", request.Description.Trim());
            insertCmd.Parameters.AddWithValue("reportedBy", actorId);
            insertCmd.Parameters.AddWithValue("title", request.Title.Trim());
            insertCmd.Parameters.AddWithValue("severity", severity);
            insertCmd.Parameters.AddWithValue("description", request.Description.Trim());
            insertCmd.Parameters.AddWithValue("detectedAt", request.DetectedAt);
            insertCmd.Parameters.Add("lateReportReason", NpgsqlDbType.Text).Value = (object?)request.LateReportReason?.Trim() ?? DBNull.Value;
            insertCmd.Parameters.Add("relatedPlate", NpgsqlDbType.Text).Value = (object?)request.RelatedPlate?.Trim() ?? DBNull.Value;
            insertCmd.Parameters.Add("relatedSlotCode", NpgsqlDbType.Text).Value = (object?)request.RelatedSlotCode?.Trim() ?? DBNull.Value;
            insertCmd.Parameters.Add("relatedGate", NpgsqlDbType.Text).Value = (object?)request.RelatedGate?.Trim() ?? DBNull.Value;
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

        await AppendScrum99AuditLogAsync(
            conn, tx, lotId, actorId,
            action: "CREATE_INCIDENT",
            entityType: "PARKING_ISSUE",
            entityId: incidentId.ToString(),
            reason: request.LateReportReason?.Trim(),
            requestId: requestId?.ToString(),
            oldValues: null,
            newValues: new { title = request.Title.Trim(), type = request.Type.Trim(), severity, status = "Open", version = 1 },
            now: now, ct: ct);

        var result = new IncidentDto(
            IncidentId: incidentId,
            LotId: lotId,
            Title: request.Title.Trim(),
            Type: request.Type.Trim(),
            Severity: severity,
            Description: request.Description.Trim(),
            Status: "Open",
            ReportedByUserId: actorId,
            DetectedAt: request.DetectedAt,
            ReportedAt: now,
            UpdatedAt: now,
            ResolvedAt: null,
            LateReportReason: request.LateReportReason?.Trim(),
            RelatedPlate: request.RelatedPlate?.Trim(),
            RelatedSlotCode: request.RelatedSlotCode?.Trim(),
            RelatedGate: request.RelatedGate?.Trim(),
            RelatedBookingId: request.RelatedBookingId,
            RelatedSessionId: request.RelatedSessionId,
            Evidence: evidenceList,
            ExitDecision: null,
            Version: 1
        );

        await SaveScrum99InboxAsync(conn, tx, requestId, "CreateIncident", fingerprint, result, now, ct);

        await tx.CommitAsync(ct);
        return result;
    }

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

    public Task<IncidentDto> UpdateIncidentStatusAsync(
        Guid lotId,
        Guid incidentId,
        Guid actorId,
        UpdateIncidentStatusRequestDto request,
        CancellationToken ct)
        => UpdateIncidentStatusAsync(lotId, incidentId, actorId, request, null, ct);

    /// <summary>
    /// Cập nhật tiến độ xử lý sự cố bằng version guard, ghi lịch sử và audit trong cùng transaction.
    /// </summary>
    public async Task<IncidentDto> UpdateIncidentStatusAsync(
        Guid lotId,
        Guid incidentId,
        Guid actorId,
        UpdateIncidentStatusRequestDto request,
        string? key,
        CancellationToken ct)
    {
        if (!CanonicalIncidentTargetStatuses.TryGetValue(request.Status.Trim(), out var targetStatus))
            throw new ServiceException(400, "Status must be one of: InProgress, Escalated, Resolved.");
        var notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim();
        if (targetStatus is "Escalated" or "Resolved" && notes is null)
            throw new ServiceException(400, "Notes are required when escalating or resolving an incident.");
        if (notes is not null && notes.Length > 2000)
            throw new ServiceException(400, "Notes must not exceed 2000 characters.");

        await using var conn = await db.OpenConnectionAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);

        var (replayed, existingOutcome, requestId, fingerprint) = await TryReplayScrum99InboxAsync<IncidentDto>(
            conn, tx, $"UpdateIncidentStatus:{lotId}:{incidentId}:{actorId}", "UpdateIncidentStatus", request, key, ct);
        if (replayed)
        {
            await tx.CommitAsync(ct);
            return existingOutcome!;
        }

        string currentStatus;
        int currentVersion;
        await using (var lockCmd = new NpgsqlCommand("""
            SELECT status, version FROM parking_issues
            WHERE lot_id = @lotId AND id = @incidentId
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

        if (!AllowedIncidentTransitions.TryGetValue(currentStatus, out var allowedNext) ||
            !allowedNext.Contains(targetStatus))
        {
            throw new ServiceException(409, $"Không thể chuyển trạng thái sự cố từ {currentStatus} sang {targetStatus}.");
        }

        if (currentVersion != request.ExpectedVersion)
            throw new ServiceException(409, $"Xung đột dữ liệu: Phiên bản hiện tại là {currentVersion}, yêu cầu của bạn dựa trên phiên bản {request.ExpectedVersion}. Vui lòng làm mới trang.");

        var now = clock.GetUtcNow();
        var isResolved = targetStatus == "Resolved";

        await using (var updateCmd = new NpgsqlCommand("""
            UPDATE parking_issues
            SET status = @newStatus,
                resolution = CASE WHEN @isResolved THEN coalesce(@notes, resolution) ELSE resolution END,
                resolved_at = CASE WHEN @isResolved THEN @now ELSE resolved_at END,
                version = version + 1,
                updated_at = @now
            WHERE lot_id = @lotId AND id = @incidentId AND version = @expectedVersion
            """, conn, tx))
        {
            updateCmd.Parameters.AddWithValue("newStatus", targetStatus);
            updateCmd.Parameters.AddWithValue("isResolved", isResolved);
            updateCmd.Parameters.Add("notes", NpgsqlDbType.Text).Value = (object?)notes ?? DBNull.Value;
            updateCmd.Parameters.AddWithValue("now", now);
            updateCmd.Parameters.AddWithValue("lotId", lotId);
            updateCmd.Parameters.AddWithValue("incidentId", incidentId);
            updateCmd.Parameters.AddWithValue("expectedVersion", request.ExpectedVersion);
            if (await updateCmd.ExecuteNonQueryAsync(ct) != 1)
                throw new ServiceException(409, "Incident changed. Refresh the current version and retry.");
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
            histCmd.Parameters.AddWithValue("toStatus", targetStatus);
            histCmd.Parameters.AddWithValue("actorId", actorId);
            histCmd.Parameters.Add("reason", NpgsqlDbType.Text).Value = (object?)notes ?? DBNull.Value;
            histCmd.Parameters.AddWithValue("now", now);
            await histCmd.ExecuteNonQueryAsync(ct);
        }

        await AppendScrum99AuditLogAsync(
            conn, tx, lotId, actorId,
            action: "UPDATE_INCIDENT_STATUS",
            entityType: "PARKING_ISSUE",
            entityId: incidentId.ToString(),
            reason: notes,
            requestId: requestId?.ToString(),
            oldValues: new { status = currentStatus, version = currentVersion },
            newValues: new { status = targetStatus, version = currentVersion + 1 },
            now: now, ct: ct);

        var updated = (await ReadIncidentByIdAsync(conn, tx, lotId, incidentId, ct))!;
        await SaveScrum99InboxAsync(conn, tx, requestId, "UpdateIncidentStatus", fingerprint, updated, now, ct);

        await tx.CommitAsync(ct);
        return updated;
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
    public Task<IncidentDto> ReopenIncidentAsync(
        Guid lotId,
        Guid incidentId,
        Guid actorId,
        ReopenIncidentRequestDto request,
        CancellationToken ct)
        => ReopenIncidentAsync(lotId, incidentId, actorId, request, null, ct);

    /// <summary>
    /// Quản lý mở lại sự cố từ trạng thái Resolved về Open kèm lý do, lưu lịch sử, audit log và idempotency.
    /// </summary>
    public async Task<IncidentDto> ReopenIncidentAsync(
        Guid lotId,
        Guid incidentId,
        Guid actorId,
        ReopenIncidentRequestDto request,
        string? key,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Reason) || request.Reason.Trim().Length > 2000)
            throw new ServiceException(400, "Lý do mở lại sự cố (reason) là bắt buộc và tối đa 2000 ký tự.");

        var reason = request.Reason.Trim();
        await using var conn = await db.OpenConnectionAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);

        var (replayed, existingOutcome, requestId, fingerprint) = await TryReplayScrum99InboxAsync<IncidentDto>(
            conn, tx, $"ReopenIncident:{lotId}:{incidentId}:{actorId}", "ReopenIncident", request, key, ct);
        if (replayed)
        {
            await tx.CommitAsync(ct);
            return existingOutcome!;
        }

        string currentStatus;
        int currentVersion;
        await using (var lockCmd = new NpgsqlCommand("""
            SELECT status, version FROM parking_issues
            WHERE lot_id = @lotId AND id = @incidentId
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
            WHERE lot_id = @lotId AND id = @incidentId AND version = @expectedVersion
            """, conn, tx))
        {
            updateCmd.Parameters.AddWithValue("now", now);
            updateCmd.Parameters.AddWithValue("lotId", lotId);
            updateCmd.Parameters.AddWithValue("incidentId", incidentId);
            updateCmd.Parameters.AddWithValue("expectedVersion", request.ExpectedVersion);
            if (await updateCmd.ExecuteNonQueryAsync(ct) != 1)
                throw new ServiceException(409, "Incident changed. Refresh the current version and retry.");
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
            histCmd.Parameters.AddWithValue("reason", reason);
            histCmd.Parameters.AddWithValue("now", now);
            await histCmd.ExecuteNonQueryAsync(ct);
        }

        await AppendScrum99AuditLogAsync(
            conn, tx, lotId, actorId,
            action: "REOPEN_INCIDENT",
            entityType: "PARKING_ISSUE",
            entityId: incidentId.ToString(),
            reason: reason,
            requestId: requestId?.ToString(),
            oldValues: new { status = currentStatus, version = currentVersion },
            newValues: new { status = "Open", version = currentVersion + 1 },
            now: now, ct: ct);

        var updated = (await ReadIncidentByIdAsync(conn, tx, lotId, incidentId, ct))!;
        await SaveScrum99InboxAsync(conn, tx, requestId, "ReopenIncident", fingerprint, updated, now, ct);

        await tx.CommitAsync(ct);
        return updated;
    }

    public Task<IncidentDto> CancelIncidentAsync(
        Guid lotId,
        Guid incidentId,
        Guid actorId,
        CancelIncidentRequestDto request,
        CancellationToken ct)
        => CancelIncidentAsync(lotId, incidentId, actorId, request, null, ct);

    /// <summary>
    /// Hủy sự cố (báo nhầm) và cập nhật trạng thái Cancelled kèm lý do trong lịch sử, audit log và idempotency.
    /// </summary>
    public async Task<IncidentDto> CancelIncidentAsync(
        Guid lotId,
        Guid incidentId,
        Guid actorId,
        CancelIncidentRequestDto request,
        string? key,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Reason) || request.Reason.Trim().Length > 2000)
            throw new ServiceException(400, "Lý do hủy báo cáo sự cố (reason) là bắt buộc và tối đa 2000 ký tự.");

        var reason = request.Reason.Trim();
        await using var conn = await db.OpenConnectionAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);

        var (replayed, existingOutcome, requestId, fingerprint) = await TryReplayScrum99InboxAsync<IncidentDto>(
            conn, tx, $"CancelIncident:{lotId}:{incidentId}:{actorId}", "CancelIncident", request, key, ct);
        if (replayed)
        {
            await tx.CommitAsync(ct);
            return existingOutcome!;
        }

        string currentStatus;
        int currentVersion;
        await using (var lockCmd = new NpgsqlCommand("""
            SELECT status, version FROM parking_issues
            WHERE lot_id = @lotId AND id = @incidentId
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
            WHERE lot_id = @lotId AND id = @incidentId AND version = @expectedVersion
            """, conn, tx))
        {
            updateCmd.Parameters.AddWithValue("now", now);
            updateCmd.Parameters.AddWithValue("lotId", lotId);
            updateCmd.Parameters.AddWithValue("incidentId", incidentId);
            updateCmd.Parameters.AddWithValue("expectedVersion", request.ExpectedVersion);
            if (await updateCmd.ExecuteNonQueryAsync(ct) != 1)
                throw new ServiceException(409, "Incident changed. Refresh the current version and retry.");
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
            histCmd.Parameters.AddWithValue("reason", reason);
            histCmd.Parameters.AddWithValue("now", now);
            await histCmd.ExecuteNonQueryAsync(ct);
        }

        await AppendScrum99AuditLogAsync(
            conn, tx, lotId, actorId,
            action: "CANCEL_INCIDENT",
            entityType: "PARKING_ISSUE",
            entityId: incidentId.ToString(),
            reason: reason,
            requestId: requestId?.ToString(),
            oldValues: new { status = currentStatus, version = currentVersion },
            newValues: new { status = "Cancelled", version = currentVersion + 1 },
            now: now, ct: ct);

        var updated = (await ReadIncidentByIdAsync(conn, tx, lotId, incidentId, ct))!;
        await SaveScrum99InboxAsync(conn, tx, requestId, "CancelIncident", fingerprint, updated, now, ct);

        await tx.CommitAsync(ct);
        return updated;
    }

    public Task<IncidentExitDecisionDto> CreateIncidentDecisionAsync(
        Guid lotId,
        Guid incidentId,
        Guid actorId,
        CreateIncidentDecisionRequestDto request,
        CancellationToken ct)
        => CreateIncidentDecisionAsync(lotId, incidentId, actorId, request, null, ct);

    /// <summary>
    /// Ban hành quyết định xử lý ngoại lệ xuất bãi (Approved/Rejected) kèm chứng cứ đối chiếu, audit log và idempotency.
    /// </summary>
    public async Task<IncidentExitDecisionDto> CreateIncidentDecisionAsync(
        Guid lotId,
        Guid incidentId,
        Guid actorId,
        CreateIncidentDecisionRequestDto request,
        string? key,
        CancellationToken ct)
    {
        var decision = string.Equals(request.Decision?.Trim(), "Approved", StringComparison.OrdinalIgnoreCase)
            ? "Approved"
            : string.Equals(request.Decision?.Trim(), "Rejected", StringComparison.OrdinalIgnoreCase)
                ? "Rejected"
                : null;
        if (decision is null)
            throw new ServiceException(400, "Decision must be either 'Approved' or 'Rejected'.");
        if (string.IsNullOrWhiteSpace(request.Reason) || request.Reason.Trim().Length > 2000)
            throw new ServiceException(400, "Reason is required for incident decision and must not exceed 2000 characters.");

        var evidenceList = request.Evidence ?? (IReadOnlyList<IncidentEvidenceDto>)Array.Empty<IncidentEvidenceDto>();
        if (!IncidentEvidenceRules.AreAllItemsValid(evidenceList))
            throw new ServiceException(400, "Each evidence item must specify a valid kind and a safe non-base64 reference (max 2048 chars).");

        var isApproved = decision == "Approved";
        if (isApproved && !IncidentEvidenceRules.HasApprovedExitEvidence(evidenceList))
        {
            throw new ServiceException(400, "Quyết định phê duyệt ngoại lệ (Approved) bắt buộc phải có chứng cứ camera và giấy tờ xe.");
        }

        await using var conn = await db.OpenConnectionAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);

        var (replayed, existingOutcome, requestId, fingerprint) = await TryReplayScrum99InboxAsync<IncidentExitDecisionDto>(
            conn, tx, $"CreateIncidentDecision:{lotId}:{incidentId}:{actorId}", "CreateIncidentDecision", request, key, ct);
        if (replayed)
        {
            await tx.CommitAsync(ct);
            return existingOutcome!;
        }

        string currentStatus;
        int currentVersion;
        bool hasBooking;
        await using (var lockCmd = new NpgsqlCommand("""
            SELECT status, version, booking_id FROM parking_issues
            WHERE lot_id = @lotId AND id = @incidentId
            """, conn, tx))
        {
            lockCmd.Parameters.AddWithValue("lotId", lotId);
            lockCmd.Parameters.AddWithValue("incidentId", incidentId);
            await using var r = await lockCmd.ExecuteReaderAsync(ct);
            if (!await r.ReadAsync(ct))
                throw new ServiceException(404, "Sự cố không tồn tại.");
            currentStatus = r.GetString(0);
            currentVersion = r.GetInt32(1);
            hasBooking = !r.IsDBNull(2);
        }

        if (string.Equals(currentStatus, "Cancelled", StringComparison.OrdinalIgnoreCase))
            throw new ServiceException(409, "Không thể ban hành quyết định cho sự cố đã bị hủy bỏ (Cancelled).");

        if (isApproved && !IncidentEvidenceRules.HasApprovedExitEvidence(evidenceList, requireCameraTimestamp: hasBooking))
            throw new ServiceException(400, "Sự cố có liên kết booking bắt buộc phải có chứng cứ camera kèm thời điểm chụp (capturedAt).");

        if (currentVersion != request.ExpectedVersion)
            throw new ServiceException(409, $"Xung đột dữ liệu: Phiên bản hiện tại là {currentVersion}, mong muốn {request.ExpectedVersion}.");

        var now = clock.GetUtcNow();
        var newVersion = currentVersion + 1;
        var decisionId = Guid.NewGuid();
        var reason = request.Reason.Trim();

        var decisionDto = new IncidentExitDecisionDto(
            DecisionId: decisionId,
            IncidentId: incidentId,
            Decision: decision,
            Reason: reason,
            DecidedByUserId: actorId,
            DecidedAt: now,
            Evidence: evidenceList,
            NewVersion: newVersion
        );

        var decisionJson = JsonSerializer.Serialize(decisionDto, JsonOptions);
        await ValidateStoredEvidenceAsync(conn, tx, lotId, evidenceList, ct);

        await using (var updateCmd = new NpgsqlCommand("""
            UPDATE parking_issues
            SET exit_decision = @decision::jsonb,
                version = version + 1,
                updated_at = @now
            WHERE lot_id = @lotId AND id = @incidentId AND version = @expectedVersion
            """, conn, tx))
        {
            updateCmd.Parameters.AddWithValue("decision", decisionJson);
            updateCmd.Parameters.AddWithValue("now", now);
            updateCmd.Parameters.AddWithValue("lotId", lotId);
            updateCmd.Parameters.AddWithValue("incidentId", incidentId);
            updateCmd.Parameters.AddWithValue("expectedVersion", request.ExpectedVersion);
            if (await updateCmd.ExecuteNonQueryAsync(ct) != 1)
                throw new ServiceException(409, "Incident changed. Refresh the current version and retry.");
        }

        var decisionAction = $"DECISION_{decision.ToUpperInvariant()}";
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
            histCmd.Parameters.AddWithValue("action", decisionAction);
            histCmd.Parameters.AddWithValue("actorId", actorId);
            histCmd.Parameters.AddWithValue("reason", reason);
            histCmd.Parameters.AddWithValue("now", now);
            await histCmd.ExecuteNonQueryAsync(ct);
        }

        await AppendScrum99AuditLogAsync(
            conn, tx, lotId, actorId,
            action: $"INCIDENT_{decisionAction}",
            entityType: "PARKING_ISSUE",
            entityId: incidentId.ToString(),
            reason: reason,
            requestId: requestId?.ToString(),
            oldValues: new { version = currentVersion },
            newValues: new { decisionId, decision, evidenceCount = evidenceList.Count, version = newVersion },
            now: now, ct: ct);

        await SaveScrum99InboxAsync(conn, tx, requestId, "CreateIncidentDecision", fingerprint, decisionDto, now, ct);

        await tx.CommitAsync(ct);
        return decisionDto;
    }
}
