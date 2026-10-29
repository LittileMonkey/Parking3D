using MediatR;
using Parking.Parking.Application.DTOs;

namespace Parking.Parking.Application.Features.Bookings.Commands;

// Yêu cầu cấp QR; danh tính người gọi do API lấy từ JWT, không nhận từ body.
public sealed record IssueBookingQrCommand(
    Guid BookingId,
    Guid RequestingUserId
) : IRequest<BookingQrDto>;