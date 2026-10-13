using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Parking.Parking.Api.Common;
using Parking.Parking.Application.DTOs;
using Parking.Parking.Application.Features.Bookings.Queries;
using Parking.ServiceDefaults;

namespace Parking.Parking.Api.Controllers;

[ApiController]
[Route("api/v1/bookings")]
[Authorize]
public class BookingsController : ControllerBase
{
    private readonly IMediator _mediator;

    public BookingsController(IMediator mediator)
    {
        _mediator = mediator;
    }

    // Endpoint GET: /api/v1/bookings/{bookingId}
    [HttpGet("{bookingId:guid}")]
    public async Task<IActionResult> GetBookingDetail([FromRoute] Guid bookingId, CancellationToken cancellationToken)
    {
        var query = new GetBookingDetailQuery
        {
            BookingId = bookingId,
            RequestingUserId = User.Subject()
        };

        var result = await _mediator.Send(query, cancellationToken);
        return Ok(new Common.ApiResponse<BookingDetailDto>(result, "Booking detail retrieved successfully."));
    }
}
