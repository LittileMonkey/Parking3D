namespace Parking.Parking.Application.DTOs;

public sealed record BookingQrContextDto(
    Guid BookingId,
    string BookingCode,
    Guid LotId,
    Guid VehicleId,
    Guid? CustomerId,
    string Status,
    DateTimeOffset ArrivalDeadline
);