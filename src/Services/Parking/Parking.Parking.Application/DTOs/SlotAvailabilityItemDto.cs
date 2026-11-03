namespace Parking.Parking.Application.DTOs;

// Dữ liệu công khai của một ô đỗ; không chứa biển số hay danh tính khách.
public sealed record SlotAvailabilityItemDto(
    Guid SlotId,
    string SlotCode,
    string ZoneCode,
    IReadOnlyList<string> SupportedVehicleTypes,
    IReadOnlyList<string> Features,
    string Status);
