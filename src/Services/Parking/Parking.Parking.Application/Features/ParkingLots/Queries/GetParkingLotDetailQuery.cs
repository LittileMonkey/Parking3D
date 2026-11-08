using MediatR;
using Parking.Parking.Application.DTOs;

namespace Parking.Parking.Application.Features.ParkingLots.Queries;

/// <summary>
/// Query lấy chi tiết thông tin một bãi đỗ xe theo ID
/// </summary>
public sealed record GetParkingLotDetailQuery(Guid LotId) : IRequest<ParkingLotDetailDto>;
