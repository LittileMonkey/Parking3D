using System.Security.Cryptography;
using Npgsql;
using Parking.Parking.Application.DTOs;
using Parking.Parking.Application.Interfaces;
using Parking.ServiceDefaults;

namespace Parking.Parking.Persistence.Repositories;

public sealed partial class ParkingRepository : IIncidentEvidenceRepository
{
    private const int MaxEvidenceBytes = 4 * 1024 * 1024;
    private const string EvidenceReferencePrefix = "parking-evidence:";

    public async Task<IncidentEvidenceImageDto> UploadIncidentEvidenceAsync(Guid lotId, Guid actorId,
        UploadIncidentEvidenceRequestDto request, string key, CancellationToken ct)
    {
        if (lotId == Guid.Empty || actorId == Guid.Empty)
            throw new ServiceException(400, "Valid lot and actor are required.");
        if (string.IsNullOrWhiteSpace(key) || key.Trim().Length > 128)
            throw new ServiceException(400, "Idempotency-Key must contain 1 to 128 characters.");
        var contentType = request.ContentType?.Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(request.ImageBase64) ||
            request.ImageBase64.Length > ((MaxEvidenceBytes + 2) / 3) * 4)
            throw new ServiceException(400, "Evidence image must be a PNG/JPEG file up to 4 MiB.");

        byte[] bytes;
        try { bytes = Convert.FromBase64String(request.ImageBase64); }
        catch (FormatException) { throw new ServiceException(400, "Evidence image contains invalid base64."); }
        var supported = bytes.Length is >= 8 and <= MaxEvidenceBytes && contentType switch
        {
            "image/png" => bytes.AsSpan(0, 8).SequenceEqual(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 }),
            "image/jpeg" => bytes[0] == 255 && bytes[1] == 216 && bytes[2] == 255,
            _ => false
        };
        if (!supported)
            throw new ServiceException(400, "Evidence image MIME type, signature or size is invalid.");

        var sha256 = Convert.ToHexStringLower(SHA256.HashData(bytes));
        await using var connection = await db.OpenConnectionAsync(ct);
        await using var transaction = await connection.BeginTransactionAsync(ct);
        var (replayed, outcome, requestId, fingerprint) = await TryReplayScrum99InboxAsync<IncidentEvidenceImageDto>(
            connection, transaction, $"UploadIncidentEvidence:{lotId}:{actorId}", "UploadIncidentEvidence",
            new { ContentType = contentType, Sha256 = sha256 }, key, ct);
        if (replayed) return outcome!;

        await using (var lot = new NpgsqlCommand("SELECT EXISTS(SELECT 1 FROM parking_lots WHERE id=@lot)", connection, transaction))
        {
            lot.Parameters.AddWithValue("lot", lotId);
            if (!(bool)(await lot.ExecuteScalarAsync(ct))!) throw new ServiceException(404, "Parking lot not found.");
        }

        var id = Guid.NewGuid();
        DateTimeOffset createdAt;
        await using (var insert = new NpgsqlCommand("""
            INSERT INTO incident_evidence_images(id,lot_id,uploaded_by_user_id,content_type,content_sha256,content_bytes)
            VALUES(@id,@lot,@actor,@type,@sha,@bytes) RETURNING created_at
            """, connection, transaction))
        {
            insert.Parameters.AddWithValue("id", id);
            insert.Parameters.AddWithValue("lot", lotId);
            insert.Parameters.AddWithValue("actor", actorId);
            insert.Parameters.AddWithValue("type", contentType!);
            insert.Parameters.AddWithValue("sha", sha256);
            insert.Parameters.AddWithValue("bytes", bytes);
            await using var reader = await insert.ExecuteReaderAsync(ct);
            await reader.ReadAsync(ct);
            createdAt = reader.GetFieldValue<DateTimeOffset>(0);
        }

        var result = new IncidentEvidenceImageDto(id, lotId, contentType!, EvidenceReferencePrefix + id, sha256, bytes.Length, createdAt);
        await AppendScrum99AuditLogAsync(connection, transaction, lotId, actorId, "UPLOAD_INCIDENT_EVIDENCE",
            "INCIDENT_EVIDENCE_IMAGE", id.ToString(), null, requestId?.ToString(), null,
            new { contentType, sha256, sizeBytes = bytes.Length }, createdAt, ct);
        await SaveScrum99InboxAsync(connection, transaction, requestId, "UploadIncidentEvidence", fingerprint, result, createdAt, ct);
        await transaction.CommitAsync(ct);
        return result;
    }

    public async Task<IncidentEvidenceImageContentDto?> ReadIncidentEvidenceAsync(Guid lotId, Guid evidenceId, CancellationToken ct)
    {
        await using var command = db.CreateCommand("""
            SELECT content_type,content_sha256,content_bytes,created_at
            FROM incident_evidence_images WHERE id=@id AND lot_id=@lot
            """);
        command.Parameters.AddWithValue("id", evidenceId);
        command.Parameters.AddWithValue("lot", lotId);
        await using var reader = await command.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return null;
        var bytes = reader.GetFieldValue<byte[]>(2);
        var metadata = new IncidentEvidenceImageDto(evidenceId, lotId, reader.GetString(0), EvidenceReferencePrefix + evidenceId,
            reader.GetString(1), bytes.Length, reader.GetFieldValue<DateTimeOffset>(3));
        return new IncidentEvidenceImageContentDto(metadata, Convert.ToBase64String(bytes));
    }

    private static async Task ValidateStoredEvidenceAsync(NpgsqlConnection connection, NpgsqlTransaction transaction,
        Guid lotId, IReadOnlyList<IncidentEvidenceDto> evidence, CancellationToken ct)
    {
        foreach (var item in evidence)
        {
            var reference = item.Reference.Trim();
            if (!reference.StartsWith(EvidenceReferencePrefix, StringComparison.OrdinalIgnoreCase)) continue;
            if (!Guid.TryParse(reference[EvidenceReferencePrefix.Length..], out var id))
                throw new ServiceException(400, "Invalid stored evidence reference.");
            await using var command = new NpgsqlCommand(
                "SELECT EXISTS(SELECT 1 FROM incident_evidence_images WHERE id=@id AND lot_id=@lot)", connection, transaction);
            command.Parameters.AddWithValue("id", id);
            command.Parameters.AddWithValue("lot", lotId);
            if (!(bool)(await command.ExecuteScalarAsync(ct))!)
                throw new ServiceException(404, "Evidence image does not exist in this parking lot.");
        }
    }
}
