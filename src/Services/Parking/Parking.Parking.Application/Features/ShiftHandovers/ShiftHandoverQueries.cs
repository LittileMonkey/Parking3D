using MediatR;
using Parking.Parking.Application.DTOs;
using Parking.Parking.Application.Exceptions;
using Parking.Parking.Application.Interfaces;

namespace Parking.Parking.Application.Features.ShiftHandovers;

/// <summary>
/// Query lấy danh sách tóm tắt biên bản bàn giao ca trực có phân trang và lọc quyền phạm vi.
/// </summary>
public sealed record ListShiftHandoversQuery(
    Guid LotId,
    Guid ActorId,
    bool IsManager,
    string? Status,
    int Page,
    int PageSize
) : IRequest<PagedResult<ShiftHandoverSummaryDto>>;

/// <summary>
/// Query xem chi tiết một biên bản bàn giao ca trực theo UUID.
/// </summary>
public sealed record GetShiftHandoverByIdQuery(
    Guid LotId,
    Guid HandoverId,
    Guid ActorId,
    bool IsManager
) : IRequest<ShiftHandoverDto>;

/// <summary>
/// Handler xử lý các Query tra cứu bàn giao ca trực kèm kiểm tra quyền cơ sở HANDOVER.
/// </summary>
public sealed class ShiftHandoverQueryHandlers(
    IParkingRepository repository,
    IFacilityAccess access
) :
    IRequestHandler<ListShiftHandoversQuery, PagedResult<ShiftHandoverSummaryDto>>,
    IRequestHandler<GetShiftHandoverByIdQuery, ShiftHandoverDto>
{
    /// <summary>Xử lý lấy danh sách bàn giao ca có phân quyền (Staff chỉ xem ca liên quan; Manager xem toàn bãi).</summary>
    public async Task<PagedResult<ShiftHandoverSummaryDto>> Handle(ListShiftHandoversQuery query, CancellationToken ct)
    {
        await access.RequireAsync(query.ActorId, query.LotId, "HANDOVER", ct);
        var isManager = await access.HasCapabilityAsync(query.ActorId, query.LotId, "MANAGER", ct);
        return await repository.ListShiftHandoversAsync(
            query.LotId, query.ActorId, isManager, query.Status, query.Page, query.PageSize, ct);
    }

    /// <summary>Xử lý lấy chi tiết biên bản bàn giao ca.</summary>
    public async Task<ShiftHandoverDto> Handle(GetShiftHandoverByIdQuery query, CancellationToken ct)
    {
        await access.RequireAsync(query.ActorId, query.LotId, "HANDOVER", ct);
        var isManager = await access.HasCapabilityAsync(query.ActorId, query.LotId, "MANAGER", ct);
        var handover = await repository.GetShiftHandoverByIdAsync(
            query.LotId, query.HandoverId, query.ActorId, isManager, ct);
        if (handover is null)
            throw new NotFoundException("Biên bản bàn giao ca không tồn tại.");
        return handover;
    }
}
