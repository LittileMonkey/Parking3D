namespace Parking.Parking.Application.DTOs;

public sealed record QueryTimeRangeDto(
    DateTimeOffset StartsAt,
    DateTimeOffset EndsAt
);

public sealed record SlotAvailabilityItemDto(
    Guid SlotId,
    string SlotCode,
    string ZoneCode,
    IReadOnlyList<string> SupportedVehicleTypes,
    IReadOnlyList<string> Features,
    string Status
);

public sealed record LevelAvailabilityItemDto(
    Guid LevelId,
    string LevelCode,
    string LevelName,
    IReadOnlyList<SlotAvailabilityItemDto> Slots
);

public sealed record LotAvailabilityDto(
    Guid LotId,
    string LotCode,
    QueryTimeRangeDto QueryRange,
    int TotalSlots,
    int AvailableCount,
    int HeldCount,
    int OccupiedCount,
    int MaintenanceCount,
    IReadOnlyList<LevelAvailabilityItemDto> Levels
);
