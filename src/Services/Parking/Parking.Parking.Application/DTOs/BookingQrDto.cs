namespace Parking.Parking.Application.DTOs;

// Client render QrPayload thành ảnh QR; ExpiresAt là hạn dùng của payload.
// Kết quả cấp QR cho client; không chứa khóa ký hay hash nonce trong database.
public sealed record BookingQrDto(
    Guid BookingId,
    string BookingCode,
    string QrPayload,
    DateTimeOffset ExpiresAt);
