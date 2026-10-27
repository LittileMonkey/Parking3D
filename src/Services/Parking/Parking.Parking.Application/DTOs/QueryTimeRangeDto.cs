namespace Parking.Parking.Application.DTOs;

// Khoảng thời gian thực tế đã dùng để tra cứu, sau khi bổ sung mặc định.
public sealed record QueryTimeRangeDto(
    DateTimeOffset StartsAt,
    DateTimeOffset EndsAt);
