namespace Parking.Parking.Application.DTOs;

// Một tầng và các ô đỗ thuộc tầng sau khi áp dụng bộ lọc tra cứu.
public sealed record LevelAvailabilityItemDto(
    Guid LevelId,
    string LevelCode,
    string LevelName,
    IReadOnlyList<SlotAvailabilityItemDto> Slots);
