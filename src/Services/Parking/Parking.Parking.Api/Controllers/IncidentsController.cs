using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Parking.Parking.Application.DTOs;
using Parking.Parking.Application.Features.Incidents;
using Parking.ServiceDefaults;

namespace Parking.Parking.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/parking-lots/{lotId:guid}/incidents")]
public sealed class IncidentsController(ISender sender) : ControllerBase
{
    /// <summary>
    /// I1: Báo cáo sự cố hoặc ngoại lệ mới tại bãi đỗ xe.
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> CreateIncident(
        Guid lotId,
        [FromBody] CreateIncidentRequestDto request,
        CancellationToken ct)
    {
        var key = Request.Headers["Idempotency-Key"].ToString();
        var result = await sender.Send(new CreateIncidentCommand(
            lotId, User.Subject(), request, string.IsNullOrWhiteSpace(key) ? null : key), ct);
        return StatusCode(201, new ApiResponse<IncidentDto>(result, true, 201, "Đã ghi nhận sự cố."));
    }

    /// <summary>
    /// I2: Tra cứu danh sách sự cố tại bãi đỗ xe theo bộ lọc và phân trang.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> ListIncidents(
        Guid lotId,
        [FromQuery] string? status,
        [FromQuery] string? severity,
        [FromQuery] string? query,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25,
        CancellationToken ct = default)
    {
        var result = await sender.Send(new ListIncidentsQuery(
            lotId, User.Subject(), status, severity, query, page, pageSize), ct);
        return Ok(new ApiResponse<PagedResult<IncidentSummaryDto>>(result, true, 200, "Đã tải danh sách sự cố."));
    }

    /// <summary>
    /// I3: Xem thông tin chi tiết một sự cố.
    /// </summary>
    [HttpGet("{incidentId:guid}")]
    public async Task<IActionResult> GetIncidentById(
        Guid lotId,
        Guid incidentId,
        CancellationToken ct)
    {
        var result = await sender.Send(new GetIncidentByIdQuery(lotId, incidentId, User.Subject()), ct);
        return Ok(new ApiResponse<IncidentDto>(result, true, 200, "Đã lấy chi tiết sự cố."));
    }

    /// <summary>
    /// I4: Cập nhật trạng thái xử lý sự cố (Staff: InProgress/Escalated; Manager: Resolved).
    /// </summary>
    [HttpPatch("{incidentId:guid}/status")]
    public async Task<IActionResult> UpdateIncidentStatus(
        Guid lotId,
        Guid incidentId,
        [FromBody] UpdateIncidentStatusRequestDto request,
        CancellationToken ct)
    {
        var result = await sender.Send(new UpdateIncidentStatusCommand(
            lotId, incidentId, User.Subject(), request), ct);
        return Ok(new ApiResponse<IncidentDto>(result, true, 200, "Đã cập nhật tiến độ sự cố."));
    }

    /// <summary>
    /// I5: Xem lịch sử cập nhật và hành vi xử lý sự cố.
    /// </summary>
    [HttpGet("{incidentId:guid}/history")]
    public async Task<IActionResult> GetIncidentHistory(
        Guid lotId,
        Guid incidentId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25,
        CancellationToken ct = default)
    {
        var result = await sender.Send(new GetIncidentHistoryQuery(
            lotId, incidentId, User.Subject(), page, pageSize), ct);
        return Ok(new ApiResponse<PagedResult<IncidentHistoryItemDto>>(result, true, 200, "Đã tải lịch sử sự cố."));
    }

    /// <summary>
    /// I6: Quản lý (Manager) mở lại sự cố từ trạng thái Resolved.
    /// </summary>
    [HttpPost("{incidentId:guid}/reopen")]
    public async Task<IActionResult> ReopenIncident(
        Guid lotId,
        Guid incidentId,
        [FromBody] ReopenIncidentRequestDto request,
        CancellationToken ct)
    {
        var result = await sender.Send(new ReopenIncidentCommand(
            lotId, incidentId, User.Subject(), request), ct);
        return Ok(new ApiResponse<IncidentDto>(result, true, 200, "Đã mở lại sự cố thành công."));
    }

    /// <summary>
    /// I7: Hủy báo cáo sự cố (báo nhầm) và ghi nhận lý do.
    /// </summary>
    [HttpPost("{incidentId:guid}/cancel")]
    public async Task<IActionResult> CancelIncident(
        Guid lotId,
        Guid incidentId,
        [FromBody] CancelIncidentRequestDto request,
        CancellationToken ct)
    {
        var result = await sender.Send(new CancelIncidentCommand(
            lotId, incidentId, User.Subject(), request), ct);
        return Ok(new ApiResponse<IncidentDto>(result, true, 200, "Đã hủy báo cáo sự cố."));
    }

    /// <summary>
    /// I8: Quản lý (Manager) ra quyết định duyệt/từ chối ngoại lệ xuất bãi kèm chứng cứ.
    /// </summary>
    [HttpPost("{incidentId:guid}/decisions")]
    public async Task<IActionResult> CreateIncidentDecision(
        Guid lotId,
        Guid incidentId,
        [FromBody] CreateIncidentDecisionRequestDto request,
        CancellationToken ct)
    {
        var result = await sender.Send(new CreateIncidentDecisionCommand(
            lotId, incidentId, User.Subject(), request), ct);
        return StatusCode(201, new ApiResponse<IncidentExitDecisionDto>(result, true, 201, "Đã ban hành quyết định xử lý ngoại lệ."));
    }
}
