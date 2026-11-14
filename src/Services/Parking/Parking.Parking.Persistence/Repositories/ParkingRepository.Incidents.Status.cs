using Npgsql;
using NpgsqlTypes;
using Parking.Parking.Application.DTOs;
using Parking.ServiceDefaults;

namespace Parking.Parking.Persistence.Repositories;

public sealed partial class ParkingRepository
{
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

        var (replayed, existingOutcome, requestId, fingerprint) = await TryReplayRequestAsync<IncidentDto>(
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

        await AppendAuditLogAsync(
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
        await SaveRequestOutcomeAsync(conn, tx, requestId, "UpdateIncidentStatus", fingerprint, updated, now, ct);

        await tx.CommitAsync(ct);
        return updated;
    }
}
