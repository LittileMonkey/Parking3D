using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Parking.Parking.Application.DTOs;
using Parking.Parking.Application.Features.CheckOut.Commands;
using Parking.Parking.Application.Features.CheckOut.Queries;
using Parking.ServiceDefaults;

namespace Parking.Parking.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/check-out")]
/// <summary>
/// Controller xử lý luồng Check-out 2 giai đoạn: Tra cứu cước phí và Xác nhận mở cổng xuất bãi (SCRUM-70).
/// </summary>
public sealed class CheckOutController(ISender sender) : ControllerBase
{
    /// <summary>
    /// Pha 1 (Quote): Tra cứu phiên đỗ ACTIVE theo biển số/QR, đối soát biển số và tính cước thực tế.
    /// </summary>
    [HttpPost("quote")]
    public async Task<IActionResult> GetQuote([FromBody] CheckOutQuoteRequestDto request, CancellationToken ct)
    {
        var result = await sender.Send(new GetCheckOutQuoteQuery(User.Subject(), request), ct);
        return Ok(new ApiResponse<CheckOutQuoteResultDto>(result, true, 200, "Tra cứu cước phí check-out thành công."));
    }

    /// <summary>
    /// Pha 2 (Confirm): Xác nhận thanh toán cước phí, đóng phiên đỗ, giải phóng slot và mở barrier.
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> ConfirmCheckOut([FromBody] ConfirmCheckOutRequestDto request, CancellationToken ct)
    {
        var key = Request.Headers["Idempotency-Key"].ToString();
        var result = await sender.Send(new ConfirmCheckOutCommand(User.Subject(), request, key), ct);
        return Ok(new ApiResponse<ConfirmCheckOutResultDto>(result, true, 200, "Xác nhận check-out thành công. Ô đỗ đã được giải phóng và mở barrier."));
    }
}
