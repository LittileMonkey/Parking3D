using MediatR;
using Parking.Parking.Application.DTOs;
using Parking.Parking.Application.Exceptions;
using Parking.Parking.Application.Interfaces;

namespace Parking.Parking.Application.Features.ParkingLots.Queries;

/// <summary>
/// Handler xử lý truy vấn chi tiết bãi đỗ xe qua Repository
/// </summary>
public sealed class GetParkingLotDetailQueryHandler(IParkingRepository repository)
    : IRequestHandler<GetParkingLotDetailQuery, ParkingLotDetailDto>
{
    public async Task<ParkingLotDetailDto> Handle(GetParkingLotDetailQuery request, CancellationToken cancellationToken)
    {
        var detail = await repository.GetParkingLotDetailAsync(request.LotId, cancellationToken);
        if (detail is null)
        {
            throw new NotFoundException($"Không tìm thấy bãi đỗ xe với ID: {request.LotId}");
        }

        return detail;
    }
}
