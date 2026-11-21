using Parking.Parking.Application;
using Parking.Parking.Application.Interfaces;
using Parking.Parking.Infrastructure.Repositories;
using Parking.Parking.Infrastructure.Services;
using Xunit;

namespace Parking.Microservices.Tests;

public sealed partial class ParkingWorkflowTests
{
    [PostgresFact]
    public async Task SearchEstimateMatchesBookingPriceAndDoesNotConsumeDailyGrace()
    {
        await Sql("""
            UPDATE lot_vehicle_policies SET grace_free_minutes=15 WHERE lot_id=@lot AND vehicle_type='CAR';
            UPDATE pricing_rules r SET parameters='{"blockMinutes":15,"rateVnd":1000,"dailyCapVnd":20000,"multiplier":1}'::jsonb
            FROM pricing_plans p WHERE r.plan_id=p.id AND p.lot_id=@lot AND p.vehicle_type='CAR';
            """, ("lot", Lot));
        var priceRepository = new ParkingLotRepository(data);
        var service = new EstimatedPriceService(priceRepository, new EstimateCustomer(Customer));
        var start = DateTimeOffset.UtcNow.AddHours(2);

        var first = await service.CalculateEstimatedFeeAsync(Lot, "CAR", start.UtcDateTime, 120);
        var second = await service.CalculateEstimatedFeeAsync(Lot, "CAR", start.UtcDateTime, 120);
        Assert.Equal(7000, first.TotalFee);
        Assert.Equal(first.TotalFee, second.TotalFee);
        Assert.Equal(0L, await Scalar("SELECT count(*) FROM daily_grace_claims"));

        var booking = await repository.CreateBookingAsync(Customer,
            new BookingRequest(Lot, Slot, Vehicle, start, start.AddMinutes(120)), Guid.NewGuid().ToString("N"), Ct);
        Assert.Equal((long)first.TotalFee, booking.EstimatedAmount);
        Assert.Equal(1L, await Scalar("SELECT count(*) FROM daily_grace_claims"));

        var afterClaim = await service.CalculateEstimatedFeeAsync(Lot, "CAR", start.UtcDateTime, 120);
        Assert.Equal(8000, afterClaim.TotalFee);
        // Eligibility is per user/Vietnam calendar day across all lots.
        Assert.Equal(0, await priceRepository.GetAvailableGraceMinutesAsync(
            Guid.Parse("22222222-2222-4222-8222-222222222222"), "MOTORBIKE", start, Customer, Ct));
        Assert.Equal(15, await priceRepository.GetAvailableGraceMinutesAsync(Lot, "CAR", start.AddDays(1), Customer, Ct));
    }

    private sealed record EstimateCustomer(Guid? UserId) : ICurrentPricingCustomer;
}
