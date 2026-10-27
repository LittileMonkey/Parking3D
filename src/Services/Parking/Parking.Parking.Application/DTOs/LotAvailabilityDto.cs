namespace Parking.Parking.Application.DTOs;

// Kết quả availability: các bộ đếm áp dụng cho tập ô đỗ đã lọc.
public sealed record LotAvailabilityDto(
    Guid LotId,
    string LotCode,
    QueryTimeRangeDto QueryRange,
    int TotalSlots,
    int AvailableCount,
    int HeldCount,
    int OccupiedCount,
    int MaintenanceCount,
    IReadOnlyList<LevelAvailabilityItemDto> Levels);
