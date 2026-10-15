using Parking.Parking.Application.DTOs;

namespace Parking.Parking.Application;

public interface IParkingRepository
{
    Task<IReadOnlyList<LotView>> ListLotsAsync(CancellationToken ct);
    Task<bool> LotExistsAsync(Guid lotId, CancellationToken ct);
    Task<BookingView> CreateBookingAsync(Guid customerId, BookingRequest request, string key, CancellationToken ct);

    // SCRUM-48: S2-04 Query methods & background worker operations
    Task<LotAvailabilityDto> GetLotAvailabilityAsync(
        Guid lotId,
        DateTimeOffset? startTime,
        DateTimeOffset? endTime,
        string? vehicleType,
        Guid? levelId,
        CancellationToken ct
    );

    Task<(BookingDetailDto Detail, Guid? CustomerId, Guid LotId)?> GetBookingDetailAsync(
        Guid bookingId,
        CancellationToken ct
    );

    Task<int> ExpireHoldsAsync(CancellationToken ct);
}

