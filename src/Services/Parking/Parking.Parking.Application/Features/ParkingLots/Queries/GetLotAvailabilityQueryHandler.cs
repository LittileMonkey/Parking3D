using MediatR;
using Parking.Parking.Application.DTOs;

namespace Parking.Parking.Application.Features.ParkingLots.Queries;

// SCRUM-48: chuyển query sang repository đọc availability; SQL nằm ở Persistence.
// Điều phối truy vấn qua interface; Application không mở kết nối PostgreSQL.
public sealed class GetLotAvailabilityQueryHandler(IParkingRepository repository)
    : IRequestHandler<GetLotAvailabilityQuery, LotAvailabilityDto>
{
    /// <summary>Chuyển bộ lọc tra cứu sang Repository và trả DTO; không truy cập SQL tại Application.</summary>
    public Task<LotAvailabilityDto> Handle(GetLotAvailabilityQuery request, CancellationToken cancellationToken) =>
        repository.GetLotAvailabilityAsync(
            request.LotId,
            request.StartTime,
            request.EndTime,
            request.VehicleType,
            request.LevelId,
            cancellationToken);
}
