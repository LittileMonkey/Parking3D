using MediatR;
using Parking.Parking.Application.DTOs;
using Parking.Parking.Application.Exceptions;

namespace Parking.Parking.Application.Features.Bookings.Queries;

public sealed class GetBookingDetailQueryHandler(IParkingRepository repository, IFacilityAccess access)
    : IRequestHandler<GetBookingDetailQuery, BookingDetailDto>
{
    public async Task<BookingDetailDto> Handle(GetBookingDetailQuery request, CancellationToken cancellationToken)
    {
        var record = await repository.GetBookingDetailAsync(request.BookingId, cancellationToken)
            ?? throw new NotFoundException("Booking not found.");
        if (record.CustomerId != request.RequestingUserId)
            await access.RequireAsync(request.RequestingUserId, record.LotId, "LOOKUP", cancellationToken);
        return record.Detail;
    }
}
