using MediatR;
using Parking.Parking.Application.DTOs;
using Parking.Parking.Application.Exceptions;

namespace Parking.Parking.Application.Features.Bookings.Queries;

// Chủ booking được xem; người khác phải có quyền LOOKUP tại đúng bãi qua Identity.
public sealed class GetBookingDetailQueryHandler(IParkingRepository repository, IFacilityAccess access)
    : IRequestHandler<GetBookingDetailQuery, BookingDetailDto>
{
    /// <summary>Đọc booking; cho phép chủ sở hữu hoặc người được Identity cấp LOOKUP tại đúng bãi xem chi tiết.</summary>
    public async Task<BookingDetailDto> Handle(GetBookingDetailQuery request, CancellationToken cancellationToken)
    {
        var record = await repository.GetBookingDetailAsync(request.BookingId, cancellationToken)
            ?? throw new NotFoundException("Booking not found.");
        if (record.CustomerId != request.RequestingUserId)
            await access.RequireAsync(request.RequestingUserId, record.LotId, "LOOKUP", cancellationToken);
        return record.Detail;
    }
}
