using MediatR;
using Parking.Parking.Application.DTOs;

namespace Parking.Parking.Application.Features.ParkingLots.Queries;

// Query tra cứu khả dụng bãi xe theo khung thời gian và loại xe
public class GetLotAvailabilityQuery : IRequest<LotAvailabilityDto>
{
    public Guid LotId { get; set; }
    public DateTimeOffset? StartTime { get; set; }
    public DateTimeOffset? EndTime { get; set; }
    public string? VehicleType { get; set; }
    public Guid? LevelId { get; set; }
}
