using System.Text.Json;
using Npgsql;
using Parking.Parking.Application.DTOs;
using Parking.Parking.Application.Features.Incidents;
using Parking.ServiceDefaults;

namespace Parking.Parking.Persistence.Repositories;

public sealed partial class ParkingRepository
{
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

        var (replayed, existingOutcome, requestId, fingerprint) = await TryReplayRequestAsync<IncidentExitDecisionDto>(
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

        await AppendAuditLogAsync(
            conn, tx, lotId, actorId,
            action: $"INCIDENT_{decisionAction}",
            entityType: "PARKING_ISSUE",
            entityId: incidentId.ToString(),
            reason: reason,
            requestId: requestId?.ToString(),
            oldValues: new { version = currentVersion },
            newValues: new { decisionId, decision, evidenceCount = evidenceList.Count, version = newVersion },
            now: now, ct: ct);

        await SaveRequestOutcomeAsync(conn, tx, requestId, "CreateIncidentDecision", fingerprint, decisionDto, now, ct);

        await tx.CommitAsync(ct);
        return decisionDto;
    }
}
