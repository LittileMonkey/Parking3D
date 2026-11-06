using MediatR;
using Parking.Parking.Application.DTOs;

namespace Parking.Parking.Application.Features.ParkingLots.Queries;

/// <summary>
/// Query lấy cây cấu trúc không gian 3D của bãi đỗ xe phục vụ Three.js Digital Twin
/// </summary>
public sealed record GetLotLayout3DQuery(Guid LotId) : IRequest<LotLayout3DDto>;
