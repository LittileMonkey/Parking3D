using System.Text.Json;
using Npgsql;
using NpgsqlTypes;
using Parking.Parking.Application.DTOs;
using Parking.Parking.Application.Features.Incidents;
using Parking.ServiceDefaults;

namespace Parking.Parking.Persistence.Repositories;

public sealed partial class ParkingRepository
{
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

        var (replayed, existingOutcome, requestId, fingerprint) = await TryReplayRequestAsync<IncidentDto>(
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

        await AppendAuditLogAsync(
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

        await SaveRequestOutcomeAsync(conn, tx, requestId, "CreateIncident", fingerprint, result, now, ct);

        await tx.CommitAsync(ct);
        return result;
    }
}
