using MediatR;
using Parking.Parking.Application.DTOs;

namespace Parking.Parking.Application.Features.ParkingLots.Queries;

// Đầu vào tra cứu; Repository bổ sung thời gian mặc định nếu người dùng bỏ trống.
public sealed class GetLotAvailabilityQuery : IRequest<LotAvailabilityDto>
{
    public Guid LotId { get; init; }
    public DateTimeOffset? StartTime { get; init; }
    public DateTimeOffset? EndTime { get; init; }
    public string? VehicleType { get; init; }
    public Guid? LevelId { get; init; }
}
