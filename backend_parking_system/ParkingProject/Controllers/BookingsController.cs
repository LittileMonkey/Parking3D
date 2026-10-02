using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using ParkingProject.Contracts;
using ParkingProject.Services;
namespace ParkingProject.Controllers;

[ApiController]
[Route("api/bookings")]
[EnableRateLimiting("guest-bookings")]
public class BookingsController(BookingService service, IConfiguration configuration) : ControllerBase
{
    private bool Enabled => configuration.GetValue<bool>("Features:GuestBookings");
    [HttpPost("guest")]
    public async Task<IActionResult> Create(CreateGuestBooking request, CancellationToken ct)
    {
        if (!Enabled) return StatusCode(503, new { message = "GuestBookings chưa được bật. Xem README." });
        var result = await service.CreateAsync(request, ct);
        return CreatedAtAction(nameof(Get), new { id = result.Booking.Id }, result);
    }
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, [FromHeader(Name = "X-Booking-Token")] string? token, CancellationToken ct)
    {
        if (!Enabled) return StatusCode(503);
        if (string.IsNullOrWhiteSpace(token)) return Unauthorized();
        var booking = await service.GetAsync(id, token, ct);
        return booking is null ? NotFound() : Ok(booking);
    }
    [HttpPost("{id:guid}/cancel")]
    public async Task<IActionResult> Cancel(Guid id, [FromHeader(Name = "X-Booking-Token")] string? token, CancellationToken ct)
    {
        if (!Enabled) return StatusCode(503);
        if (string.IsNullOrWhiteSpace(token)) return Unauthorized();
        var booking = await service.CancelAsync(id, token, ct);
        return booking is null ? NotFound() : Ok(booking);
    }
}
