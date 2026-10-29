namespace Parking.Parking.Application.DTOs;

// Hợp đồng check-in: yêu cầu xác minh xe và kết quả phiên gửi xe đã được commit.
public sealed record CheckInRequestDto(Guid LotId, Guid GateId, string QrPayload, string DetectedPlate);

public sealed record CheckInResponseDto(
    Guid SessionId, Guid BookingId, Guid LotId, Guid SlotId, string Status, DateTimeOffset EntryAt);
