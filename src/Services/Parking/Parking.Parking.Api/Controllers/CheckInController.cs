using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Parking.Parking.Application.DTOs;
using Parking.Parking.Application.Features.Bookings.Commands;
using Parking.ServiceDefaults;

namespace Parking.Parking.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/check-in")]
// Nhận HTTP, lấy actor từ JWT và chuyển yêu cầu check-in sang MediatR.
public sealed class CheckInController(ISender sender) : ControllerBase
{
    /// <summary>Nhận dữ liệu quét và Idempotency-Key, lấy Staff từ JWT rồi chuyển sang MediatR.</summary>
    [HttpPost]
    public async Task<IActionResult> CheckIn([FromBody] CheckInRequestDto request, CancellationToken ct)
    {
        var result = await sender.Send(new CheckInCommand(
            User.Subject(), request, Request.Headers["Idempotency-Key"].ToString()), ct);
        return Ok(new ApiResponse<CheckInResponseDto>(result, true, 200, "Check-in successful."));
    }
}
