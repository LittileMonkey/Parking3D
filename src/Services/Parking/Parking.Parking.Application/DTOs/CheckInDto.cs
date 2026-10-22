namespace Parking.Parking.Application.DTOs;

public sealed record CheckInRequestDto(Guid LotId, Guid GateId, string QrPayload, string DetectedPlate);

public sealed record CheckInResponseDto(
    Guid SessionId, Guid BookingId, Guid LotId, Guid SlotId, string Status, DateTimeOffset EntryAt);
