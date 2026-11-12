using Parking.Parking.Application.DTOs;
using Parking.Parking.Application.Exceptions;

namespace Parking.Parking.Application;

public sealed record LotView(Guid Id, string Code, string Name, string Address, double Latitude, double Longitude, string Timezone);
public sealed record BookingRequest(Guid LotId, Guid SlotId, Guid VehicleId, DateTimeOffset StartsAt, DateTimeOffset EndsAt);
public sealed record BookingView(Guid Id, string Code, string Status, long EstimatedAmount, DateTimeOffset HoldExpiresAt, int Version);
public sealed record RecognitionUpload(string ImageBase64, string ContentType);
public sealed record RecognitionView(Guid Id, string Status, string? CandidatePlate, double? Confidence, string ModelVersion);

public interface IFacilityAccess
{
    Task RequireAsync(Guid userId, Guid lotId, string capability, CancellationToken ct);

    /// <summary>
    /// Checks whether the user holds a facility-scoped capability without suppressing 503 availability errors.
    /// </summary>
    async Task<bool> HasCapabilityAsync(Guid userId, Guid lotId, string capability, CancellationToken ct)
    {
        try
        {
            await RequireAsync(userId, lotId, capability, ct);
            return true;
        }
        catch (ForbiddenAccessException)
        {
            return false;
        }
        catch (Exception ex) when (ex.GetType().FullName == "Parking.ServiceDefaults.ServiceException" &&
                                   ex.GetType().GetProperty("StatusCode")?.GetValue(ex) is 403)
        {
            return false;
        }
    }
}

public interface IRecognitionClient
{
    Task<RecognitionView> RecognizeAsync(Guid userId, Guid lotId, string key, RecognitionUpload upload, CancellationToken ct);
}

