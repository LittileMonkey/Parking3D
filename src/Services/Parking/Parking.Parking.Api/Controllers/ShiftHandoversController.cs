using System.Security.Claims;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Parking.Parking.Application.DTOs;
using Parking.Parking.Application.Features.ShiftHandovers;
using Parking.ServiceDefaults;

namespace Parking.Parking.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/parking-lots/{lotId:guid}/shift-handovers")]
public sealed class ShiftHandoversController(ISender sender) : ControllerBase
{
    private bool IsManagerUser()
    {
        return User.IsInRole("PARKING_MANAGER") ||
               User.IsInRole("ADMIN") ||
               User.IsInRole("PARKING_ADMIN") ||
               User.HasClaim(c => c.Type == ClaimTypes.Role &&
                   (c.Value == "PARKING_MANAGER" || c.Value == "ADMIN" || c.Value == "PARKING_ADMIN"));
    }

    /// <summary>
    /// H1: Nhân viên giao ca tạo biên bản bàn giao ca trực mới (PendingConfirmation).
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> CreateShiftHandover(
        Guid lotId,
        [FromBody] CreateShiftHandoverRequestDto request,
        CancellationToken ct)
    {
        var key = Request.Headers["Idempotency-Key"].ToString();
        var result = await sender.Send(new CreateShiftHandoverCommand(
            lotId, User.Subject(), request, string.IsNullOrWhiteSpace(key) ? null : key), ct);
        return StatusCode(201, new ApiResponse<ShiftHandoverDto>(result, true, 201, "Đã gửi biên bản bàn giao, chờ người nhận xác nhận."));
    }

    /// <summary>
    /// H2: Tra cứu danh sách biên bản bàn giao ca (Staff xem bản mình gửi/nhận; Manager xem toàn bộ tại bãi).
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> ListShiftHandovers(
        Guid lotId,
        [FromQuery] string? status,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25,
        CancellationToken ct = default)
    {
        var result = await sender.Send(new ListShiftHandoversQuery(
            lotId, User.Subject(), IsManagerUser(), status, page, pageSize), ct);
        return Ok(new ApiResponse<PagedResult<ShiftHandoverSummaryDto>>(result, true, 200, "Đã tải danh sách bàn giao ca."));
    }

    /// <summary>
    /// H3: Xem chi tiết biên bản bàn giao ca trực.
    /// </summary>
    [HttpGet("{handoverId:guid}")]
    public async Task<IActionResult> GetShiftHandoverById(
        Guid lotId,
        Guid handoverId,
        CancellationToken ct)
    {
        var result = await sender.Send(new GetShiftHandoverByIdQuery(
            lotId, handoverId, User.Subject(), IsManagerUser()), ct);
        return Ok(new ApiResponse<ShiftHandoverDto>(result, true, 200, "Đã lấy chi tiết biên bản bàn giao ca."));
    }

    /// <summary>
    /// H4: Nhân viên nhận ca xác nhận hoàn tất nhận ca trực (Handshake).
    /// </summary>
    [HttpPost("{handoverId:guid}/confirm")]
    public async Task<IActionResult> ConfirmShiftHandover(
        Guid lotId,
        Guid handoverId,
        [FromBody] ConfirmShiftHandoverRequestDto request,
        CancellationToken ct)
    {
        var key = Request.Headers["Idempotency-Key"].ToString();
        var result = await sender.Send(new ConfirmShiftHandoverCommand(
            lotId, handoverId, User.Subject(), request, string.IsNullOrWhiteSpace(key) ? null : key), ct);
        return Ok(new ApiResponse<ShiftHandoverDto>(result, true, 200, "Xác nhận nhận ca trực thành công."));
    }

    /// <summary>
    /// H5: Quản lý (Manager) chỉ định lại nhân viên nhận ca khi người cũ vắng mặt hoặc bị khóa.
    /// </summary>
    [HttpPatch("{handoverId:guid}/receiver")]
    public async Task<IActionResult> ReassignReceiver(
        Guid lotId,
        Guid handoverId,
        [FromBody] ReassignReceiverRequestDto request,
        CancellationToken ct)
    {
        var result = await sender.Send(new ReassignReceiverCommand(
            lotId, handoverId, User.Subject(), request), ct);
        return Ok(new ApiResponse<ShiftHandoverDto>(result, true, 200, "Đã chỉ định lại người nhận ca thành công."));
    }
}
