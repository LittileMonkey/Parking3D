using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Npgsql;
using Parking.ServiceDefaults;

namespace Parking.Parking.Persistence.Repositories;

public sealed partial class ParkingRepository
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    private static async Task<(bool Replayed, T? Outcome, Guid? RequestId, string? Fingerprint)> TryReplayRequestAsync<T>(
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

    private static async Task SaveRequestOutcomeAsync(
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
}
