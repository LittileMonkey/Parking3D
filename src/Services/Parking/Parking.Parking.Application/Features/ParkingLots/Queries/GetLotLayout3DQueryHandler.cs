using MediatR;
using Parking.Parking.Application.DTOs;
using Parking.Parking.Application.Exceptions;
using Parking.Parking.Application.Interfaces;

namespace Parking.Parking.Application.Features.ParkingLots.Queries;

/// <summary>
/// Handler xử lý lấy cây cấu trúc 3D bãi đỗ xe:
/// Tích hợp Caching TTL 12h theo yêu cầu SCRUM-80 (đảm bảo phản hồi < 20ms).
/// </summary>
public sealed class GetLotLayout3DQueryHandler(
    IParkingRepository repository,
    IParkingCacheService cache)
    : IRequestHandler<GetLotLayout3DQuery, LotLayout3DDto>
{
    public async Task<LotLayout3DDto> Handle(GetLotLayout3DQuery request, CancellationToken cancellationToken)
    {
        // Cache Key định danh cho cấu trúc 3D của từng bãi đỗ xe
        var cacheKey = $"lot_layout_{request.LotId}";

        // SCRUM-80: Tích hợp Cache với thời hạn 12 giờ
        var layout = await cache.GetOrSetAsync(
            cacheKey,
            () => repository.GetLotLayout3DAsync(request.LotId, cancellationToken),
            TimeSpan.FromHours(12),
            cancellationToken);

        if (layout is null)
        {
            throw new NotFoundException($"Không tìm thấy bãi đỗ xe với ID: {request.LotId}");
        }

        return layout;
    }
}
