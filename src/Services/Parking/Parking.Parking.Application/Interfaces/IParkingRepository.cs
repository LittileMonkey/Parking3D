using Parking.Parking.Application.DTOs;
using Parking.Parking.Application.Interfaces;
namespace Parking.Parking.Application;

public interface IParkingRepository
{
    Task<CheckInResponseDto> CheckInAsync(Guid actorId, CheckInRequestDto request,
        ValidatedQrToken token, string key, CancellationToken ct);
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

    Task<BookingQrContextDto?> GetBookingQrContextAsync(
    Guid bookingId,
    CancellationToken ct);
    Task SaveIssuedQrTokenAsync(
    Guid bookingId,
    Guid expectedLotId,
    Guid expectedVehicleId,
    GeneratedQrToken token,
    CancellationToken ct);
}

