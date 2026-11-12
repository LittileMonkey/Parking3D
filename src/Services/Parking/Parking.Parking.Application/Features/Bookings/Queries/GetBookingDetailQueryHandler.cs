using MediatR;
using Parking.Parking.Application.DTOs;
using Parking.Parking.Application.Exceptions;

namespace Parking.Parking.Application.Features.Bookings.Queries;

// Chủ booking được xem; người khác phải có quyền LOOKUP tại đúng bãi qua Identity.
public sealed class GetBookingDetailQueryHandler(IParkingRepository repository, IFacilityAccess access)
    : IRequestHandler<GetBookingDetailQuery, BookingDetailDto>
{
    /// <summary>Xác minh tài khoản còn hoạt động, đọc booking và kiểm tra quyền sở hữu hoặc quyền LOOKUP tại đúng bãi.</summary>
    public async Task<BookingDetailDto> Handle(GetBookingDetailQuery request, CancellationToken cancellationToken)
    {
        await access.RequireAsync(request.RequestingUserId, Guid.Empty, "USER", cancellationToken);

        var record = await repository.GetBookingDetailAsync(request.BookingId, cancellationToken)
            ?? throw new NotFoundException("Booking not found.");
        if (record.CustomerId != request.RequestingUserId)
            await access.RequireAsync(request.RequestingUserId, record.LotId, "LOOKUP", cancellationToken);
        return record.Detail;
    }
}
