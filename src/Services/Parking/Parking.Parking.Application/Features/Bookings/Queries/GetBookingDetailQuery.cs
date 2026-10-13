using MediatR;
using Parking.Parking.Application.DTOs;

namespace Parking.Parking.Application.Features.Bookings.Queries;

// Query tra cứu chi tiết đơn đặt chỗ
public class GetBookingDetailQuery : IRequest<BookingDetailDto>
{
    public Guid BookingId { get; set; }
    public Guid RequestingUserId { get; set; }
}
