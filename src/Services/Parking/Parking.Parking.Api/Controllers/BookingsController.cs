using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Parking.Parking.Application.DTOs;
using Parking.Parking.Application.Features.Bookings.Commands;
using Parking.Parking.Application.Features.Bookings.Queries;
using Parking.ServiceDefaults;

namespace Parking.Parking.Api.Controllers;

[ApiController]
[Route("api/v1/bookings")]
[Authorize]
public sealed class BookingsController(ISender sender) : ControllerBase
{
    // SCRUM-48: handler kiểm tra owner hoặc quyền LOOKUP tại đúng bãi.
    [HttpGet("{bookingId:guid}")]
    public async Task<IActionResult> GetBookingDetail([FromRoute] Guid bookingId, CancellationToken cancellationToken)
    {
        var query = new GetBookingDetailQuery
        {
            BookingId = bookingId,
            RequestingUserId = User.Subject()
        };
        var result = await sender.Send(query, cancellationToken);
        return Ok(new ApiResponse<BookingDetailDto>(result, true, 200, "Booking detail retrieved successfully."));
    }

    // SCRUM-49: chỉ nhận/trả HTTP; điều kiện cấp QR nằm ở Application/Persistence.
    [HttpPost("{bookingId:guid}/qr")]
    public async Task<IActionResult> IssueBookingQr([FromRoute] Guid bookingId, CancellationToken cancellationToken)
    {
        var command = new IssueBookingQrCommand(bookingId, User.Subject());
        var result = await sender.Send(command, cancellationToken);
        return Ok(new ApiResponse<BookingQrDto>(result, true, 200, "Cấp mã QR thành công."));
    }
}
