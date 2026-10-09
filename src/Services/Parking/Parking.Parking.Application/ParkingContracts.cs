namespace Parking.Parking.Application;

public sealed record LotView(Guid Id, string Code, string Name, string Address, double Latitude, double Longitude, string Timezone);
public sealed record BookingRequest(Guid LotId, Guid SlotId, Guid VehicleId, DateTimeOffset StartsAt, DateTimeOffset EndsAt);
public sealed record BookingView(Guid Id, string Code, string Status, long EstimatedAmount, DateTimeOffset HoldExpiresAt, int Version);
public sealed record RecognitionUpload(string ImageBase64, string ContentType);
public sealed record RecognitionView(Guid Id, string Status, string? CandidatePlate, double? Confidence, string ModelVersion);
public interface IFacilityAccess
{
    Task RequireAsync(Guid userId, Guid lotId, string capability, CancellationToken ct);
}
public interface IRecognitionClient
{
    Task<RecognitionView> RecognizeAsync(Guid userId, Guid lotId, string key, RecognitionUpload upload, CancellationToken ct);
}
public interface IParkingRepository
{
    Task<IReadOnlyList<LotView>> ListLotsAsync(CancellationToken ct);
    Task<bool> LotExistsAsync(Guid lotId, CancellationToken ct);
    Task<BookingView> CreateBookingAsync(Guid customerId, BookingRequest request, string key, CancellationToken ct);
}
