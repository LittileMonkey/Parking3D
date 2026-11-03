using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Parking.Parking.Application.DTOs;
using Parking.Parking.Application.Features.CheckOut.Commands;
using Parking.Parking.Application.Features.CheckOut.Queries;
using Parking.Parking.Application;
using Parking.Parking.Application.Interfaces;
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
    [HttpPost("authorize-exit")]
    public async Task<IActionResult> AuthorizeExit([FromBody] ConfirmCheckOutRequestDto request,CancellationToken ct)
    {
        var result=await sender.Send(new AuthorizeCheckOutCommand(User.Subject(),request,
            Request.Headers["Idempotency-Key"].ToString()),ct);
        return Ok(new ApiResponse<AuthorizeCheckOutResultDto>(result,true,200,
            "Payment verified. Staff may operate the exit gate; slot remains occupied until physical exit confirmation."));
    }
    [HttpPost("{sessionId:guid}/qr")]
    public async Task<IActionResult> IssueExitQr(Guid sessionId, [FromServices] IParkingRepository repository,
        [FromServices] IFacilityAccess access, [FromServices] ICheckOutTokens tokens, CancellationToken ct)
    {
        var lot = await repository.GetSessionLotIdAsync(sessionId, ct)
            ?? throw new ServiceException(404, "Parking session not found.");
        await access.RequireAsync(User.Subject(), lot, "GATE", ct);
        return Ok(new ApiResponse<CheckOutQrDto>(tokens.IssueExitQr(sessionId, lot), true, 200, "Exit QR issued."));
    }
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
        return Ok(new ApiResponse<ConfirmCheckOutResultDto>(result, true, 200, "Staff confirmed physical exit. Parking slot released."));
    }
}
