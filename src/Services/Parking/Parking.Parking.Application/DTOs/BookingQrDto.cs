namespace Parking.Parking.Application.DTOs;

// Client render QrPayload thành ảnh QR; ExpiresAt là hạn dùng của payload.
public sealed record BookingQrDto(
    Guid BookingId,
    string BookingCode,
    string QrPayload,
    DateTimeOffset ExpiresAt);
