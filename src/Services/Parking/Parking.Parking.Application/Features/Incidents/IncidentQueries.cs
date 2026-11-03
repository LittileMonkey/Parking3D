using MediatR;
using Parking.Parking.Application.DTOs;
using Parking.Parking.Application.Exceptions;
using Parking.Parking.Application.Interfaces;

namespace Parking.Parking.Application.Features.Incidents;

/// <summary>
/// Query tra cứu danh sách tóm tắt sự cố có phân trang và bộ lọc.
/// </summary>
public sealed record ListIncidentsQuery(
    Guid LotId,
    Guid ActorId,
    string? Status,
    string? Severity,
    string? Query,
    int Page,
    int PageSize
) : IRequest<PagedResult<IncidentSummaryDto>>;

/// <summary>
/// Query lấy chi tiết một sự cố theo mã định danh UUID.
/// </summary>
public sealed record GetIncidentByIdQuery(
    Guid LotId,
    Guid IncidentId,
    Guid ActorId
) : IRequest<IncidentDto>;

/// <summary>
/// Query lấy lịch sử các hành động thay đổi trạng thái sự cố có phân trang.
/// </summary>
public sealed record GetIncidentHistoryQuery(
    Guid LotId,
    Guid IncidentId,
    Guid ActorId,
    int Page,
    int PageSize
) : IRequest<PagedResult<IncidentHistoryItemDto>>;

/// <summary>
/// Handler xử lý các Query tra cứu sự cố kèm kiểm tra quyền cơ sở INCIDENT_READ.
/// </summary>
public sealed class IncidentQueryHandlers(
    IParkingRepository repository,
    IFacilityAccess access
) :
    IRequestHandler<ListIncidentsQuery, PagedResult<IncidentSummaryDto>>,
    IRequestHandler<GetIncidentByIdQuery, IncidentDto>,
    IRequestHandler<GetIncidentHistoryQuery, PagedResult<IncidentHistoryItemDto>>
{
    /// <summary>Xử lý lấy danh sách sự cố có phân trang.</summary>
    public async Task<PagedResult<IncidentSummaryDto>> Handle(ListIncidentsQuery query, CancellationToken ct)
    {
        await access.RequireAsync(query.ActorId, query.LotId, "INCIDENT_READ", ct);
        return await repository.ListIncidentsAsync(
            query.LotId, query.Status, query.Severity, query.Query, query.Page, query.PageSize, ct);
    }

    /// <summary>Xử lý lấy chi tiết sự cố.</summary>
    public async Task<IncidentDto> Handle(GetIncidentByIdQuery query, CancellationToken ct)
    {
        await access.RequireAsync(query.ActorId, query.LotId, "INCIDENT_READ", ct);
        var incident = await repository.GetIncidentByIdAsync(query.LotId, query.IncidentId, ct);
        if (incident is null)
            throw new NotFoundException("Sự cố không tồn tại tại bãi đỗ xe này.");
        return incident;
    }

    /// <summary>Xử lý lấy lịch sử sự cố.</summary>
    public async Task<PagedResult<IncidentHistoryItemDto>> Handle(GetIncidentHistoryQuery query, CancellationToken ct)
    {
        await access.RequireAsync(query.ActorId, query.LotId, "INCIDENT_READ", ct);
        return await repository.GetIncidentHistoryAsync(
            query.LotId, query.IncidentId, query.Page, query.PageSize, ct);
    }
}
