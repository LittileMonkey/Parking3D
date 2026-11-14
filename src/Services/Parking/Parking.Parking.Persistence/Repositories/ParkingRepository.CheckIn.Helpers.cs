using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Npgsql;
using Parking.Parking.Application.DTOs;

namespace Parking.Parking.Persistence.Repositories;

public sealed partial class ParkingRepository
{
    private static string ComputeCheckInFingerprint(CheckInRequestDto request, string normalizedPlate, string? normalizedVehicleType)
    {
        var payload = JsonSerializer.SerializeToNode(new
        {
            request.LotId,
            request.GateId,
            request.QrPayload,
            Plate = normalizedPlate,
            VehicleType = normalizedVehicleType,
            request.AllowMismatchOverride,
            OverrideReason = request.OverrideReason?.Trim()
        })!;
        // Keep hashes compatible with requests recorded before evidence was added.
        if (request.Evidence is { Count: > 0 })
            payload["Evidence"] = JsonSerializer.SerializeToNode(request.Evidence);
        return Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(payload.ToJsonString())));
    }

    private static string BuildSlotOccupiedEventPayload(Guid eventId, Guid lotId, Guid slotId, DateTimeOffset observedAt) =>
        JsonSerializer.Serialize(new
        {
            eventId,
            parkingLotId = lotId,
            slotId,
            status = "OCCUPIED",
            observedAt
        });

    /// <summary>Ghi nhận sự cố lệch biển số bên ngoài transaction bị rollback để không mất vết cảnh báo tại cổng.</summary>
    private static async Task RecordRejectedPlateMismatchIncidentAsync(
        NpgsqlConnection connection,
        Guid lotId,
        Guid bookingId,
        Guid actorId,
        string observedPlate,
        string slotCode,
        string reason,
        string description,
        CancellationToken ct)
    {
        var incidentId = Guid.NewGuid();
        await using var cmd = new NpgsqlCommand("""
            INSERT INTO parking_issues(
                id, lot_id, booking_id, issue_type, status, reason, reported_by,
                title, severity, description, detected_at, related_plate, related_slot_code,
                version, created_at, updated_at)
            VALUES(
                @incidentId, @lot, @booking, 'INCIDENT_0482_PLATE_MISMATCH', 'Open', @reason, @actor,
                'Cảnh báo lệch biển số khi check-in', 'High', @description, clock_timestamp(), @plate, @slotCode,
                1, clock_timestamp(), clock_timestamp());
            INSERT INTO incident_history(
                id, incident_id, lot_id, action, from_status, to_status, performed_by_user_id, reason, performed_at)
            VALUES(
                gen_random_uuid(), @incidentId, @lot, 'CREATED', NULL, 'Open', @actor, @reason, clock_timestamp());
            """, connection);
        cmd.Parameters.AddWithValue("incidentId", incidentId);
        cmd.Parameters.AddWithValue("lot", lotId);
        cmd.Parameters.AddWithValue("booking", bookingId);
        cmd.Parameters.AddWithValue("reason", reason);
        cmd.Parameters.AddWithValue("actor", actorId);
        cmd.Parameters.AddWithValue("description", description);
        cmd.Parameters.AddWithValue("plate", observedPlate);
        cmd.Parameters.AddWithValue("slotCode", slotCode);
        await cmd.ExecuteNonQueryAsync(ct);
    }
}
