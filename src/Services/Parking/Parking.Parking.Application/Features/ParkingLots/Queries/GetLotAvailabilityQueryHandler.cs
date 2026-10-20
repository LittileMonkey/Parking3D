using MediatR;
using Parking.Parking.Application.DTOs;

namespace Parking.Parking.Application.Features.ParkingLots.Queries;

// SCRUM-48: chuyển query sang repository đọc availability; SQL nằm ở Persistence.
public sealed class GetLotAvailabilityQueryHandler(IParkingRepository repository)
    : IRequestHandler<GetLotAvailabilityQuery, LotAvailabilityDto>
{
    public Task<LotAvailabilityDto> Handle(GetLotAvailabilityQuery request, CancellationToken cancellationToken) =>
        repository.GetLotAvailabilityAsync(
            request.LotId,
            request.StartTime,
            request.EndTime,
            request.VehicleType,
            request.LevelId,
            cancellationToken);
}
