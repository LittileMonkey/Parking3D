using Npgsql;
using Parking.Parking.Application.DTOs;
using Parking.ServiceDefaults;

namespace Parking.Parking.Persistence.Repositories;

public sealed partial class ParkingRepository
{
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

        var (replayed, existingOutcome, requestId, fingerprint) = await TryReplayRequestAsync<IncidentDto>(
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

        await AppendAuditLogAsync(
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
        await SaveRequestOutcomeAsync(conn, tx, requestId, "ReopenIncident", fingerprint, updated, now, ct);

        await tx.CommitAsync(ct);
        return updated;
    }
}
