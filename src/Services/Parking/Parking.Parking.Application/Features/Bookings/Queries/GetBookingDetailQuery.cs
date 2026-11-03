using MediatR;
using Parking.Parking.Application.DTOs;

namespace Parking.Parking.Application.Features.Bookings.Queries;

// Danh tính người xem do Controller lấy từ JWT; không nhận từ body của client.
public sealed class GetBookingDetailQuery : IRequest<BookingDetailDto>
{
    public Guid BookingId { get; init; }
    public Guid RequestingUserId { get; init; }
}
