using MediatR;
using Parking.Parking.Application.DTOs;

namespace Parking.Parking.Application.Features.Bookings.Commands;

public sealed record IssueBookingQrCommand(
    Guid BookingId,
    Guid RequestingUserId
) : IRequest<BookingQrDto>;