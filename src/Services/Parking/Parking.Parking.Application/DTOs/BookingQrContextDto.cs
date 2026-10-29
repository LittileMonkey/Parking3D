namespace Parking.Parking.Application.DTOs;

// Thông tin nội bộ để kiểm tra điều kiện cấp QR; không trả trực tiếp qua API.
public sealed record BookingQrContextDto(
    Guid BookingId,
    string BookingCode,
    Guid LotId,
    Guid VehicleId,
    Guid? CustomerId,
    string Status,
    DateTimeOffset ArrivalDeadline
);