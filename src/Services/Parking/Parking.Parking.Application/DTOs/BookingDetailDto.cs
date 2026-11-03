namespace Parking.Parking.Application.DTOs;

// DTO chi tiết đơn đặt chỗ
// Dữ liệu chi tiết booking sau khi Handler xác minh chủ sở hữu hoặc quyền tại bãi.
public sealed record BookingDetailDto(
    Guid BookingId,
    string BookingCode,
    Guid LotId,
    string LotName,
    Guid? SlotId,
    string? SlotCode,
    string PlateSnapshot,
    string VehicleType,
    DateTimeOffset StartsAt,
    DateTimeOffset EndsAt,
    DateTimeOffset? HoldExpiresAt,
    DateTimeOffset ArrivalDeadline,
    string Status,
    long EstimatedAmount,
    string? QrToken,
    DateTimeOffset CreatedAt
);
