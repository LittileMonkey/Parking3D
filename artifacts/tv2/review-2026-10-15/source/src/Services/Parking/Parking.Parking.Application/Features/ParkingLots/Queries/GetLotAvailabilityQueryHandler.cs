using MediatR;
using Parking.Parking.Application.DTOs;

namespace Parking.Parking.Application.Features.ParkingLots.Queries;

// Xử lý truy vấn thông tin khả dụng bãi xe
public class GetLotAvailabilityQueryHandler : IRequestHandler<GetLotAvailabilityQuery, LotAvailabilityDto>
{
    private readonly IParkingRepository _repository;

    public GetLotAvailabilityQueryHandler(IParkingRepository repository)
    {
        _repository = repository;
    }

    public async Task<LotAvailabilityDto> Handle(GetLotAvailabilityQuery request, CancellationToken cancellationToken)
    {
        return await _repository.GetLotAvailabilityAsync(
            request.LotId,
            request.StartTime,
            request.EndTime,
            request.VehicleType,
            request.LevelId,
            cancellationToken);
    }
}
