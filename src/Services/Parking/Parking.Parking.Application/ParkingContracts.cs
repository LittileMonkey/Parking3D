namespace Parking.Parking.Application;

public sealed record LotView(Guid Id, string Code, string Name, string Address, double Latitude, double Longitude, string Timezone);
public sealed record BookingRequest(Guid LotId, Guid SlotId, Guid VehicleId, DateTimeOffset StartsAt, DateTimeOffset EndsAt);
public sealed record BookingView(Guid Id, string Code, string Status, long EstimatedAmount, DateTimeOffset HoldExpiresAt, int Version);
public sealed record RecognitionUpload(string ImageBase64, string ContentType);
public sealed record RecognitionView(Guid Id, string Status, string? CandidatePlate, double? Confidence, string ModelVersion);

// SCRUM-48: S2-04 DTOs for Availability & Booking Detail
public sealed record SlotAvailabilityItem(
    Guid SlotId,
    string SlotCode,
    string ZoneCode,
    IReadOnlyList<string> SupportedVehicleTypes,
    IReadOnlyList<string> Features,
    string Status // "AVAILABLE", "HELD", "OCCUPIED", "MAINTENANCE"
);

public sealed record LevelAvailabilityItem(
    Guid LevelId,
    string LevelCode,
    string LevelName,
    IReadOnlyList<SlotAvailabilityItem> Slots
);

public sealed record QueryTimeRange(DateTimeOffset StartsAt, DateTimeOffset EndsAt);

public sealed record LotAvailabilityView(
    Guid LotId,
    string LotCode,
    QueryTimeRange QueryRange,
    int TotalSlots,
    int AvailableCount,
    int HeldCount,
    int OccupiedCount,
    int MaintenanceCount,
    IReadOnlyList<LevelAvailabilityItem> Levels
);

public sealed record BookingDetailView(
    Guid BookingId,
    string BookingCode,
    Guid LotId,
    string LotName,
    Guid? SlotId,
    string? SlotCode,
    string PlateSnapshot,
    string VehicleType,
    DateTimeOffset StartsAt,
    DateTimeOffset EndsAt,
    DateTimeOffset? HoldExpiresAt,
    DateTimeOffset ArrivalDeadline,
    string Status,
    long TotalAmount,
    string? QrToken,
    DateTimeOffset CreatedAt
);

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

    // SCRUM-48: S2-04 Query methods & background worker operations
    Task<LotAvailabilityView> GetLotAvailabilityAsync(
        Guid lotId,
        DateTimeOffset? startTime,
        DateTimeOffset? endTime,
        string? vehicleType,
        Guid? levelId,
        CancellationToken ct
    );

    Task<BookingDetailView> GetBookingDetailAsync(
        Guid bookingId,
        Guid requestingUserId,
        CancellationToken ct
    );

    Task<int> ExpireHoldsAsync(CancellationToken ct);
}
