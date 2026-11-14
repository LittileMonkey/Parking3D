using System.Text.Json;
using Npgsql;
using NpgsqlTypes;

namespace Parking.Parking.Persistence.Repositories;

public sealed partial class ParkingRepository
{
    private static async Task AppendAuditLogAsync(
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
}
