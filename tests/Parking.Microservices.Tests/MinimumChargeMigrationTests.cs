using Parking.Parking.Application;
using Parking.Parking.Application.Interfaces;
using Parking.Parking.Infrastructure.Repositories;
using Parking.Parking.Infrastructure.Services;
using Parking.Parking.Domain;
using Parking.Parking.Persistence;
using Parking.ServiceDefaults;
using Xunit;

namespace Parking.Microservices.Tests;

public sealed partial class ParkingWorkflowTests
{
    [PostgresFact]
    public async Task PublishingNewPricingRejectsMinimumBelowTenThousand()
    {
        var operations = new OperationsRepository(data);
        var exception = await Assert.ThrowsAsync<ServiceException>(() => operations.PublishAsync(Lot, Staff,
            new PublishPricing("CAR", "Invalid minimum", 1,
                new BlockPrice(15, 1000, 20000, 1, MinimumChargeVnd: 9000), "Test minimum validation"), Ct));
        Assert.Equal(400, exception.StatusCode);
    }
    [PostgresFact]
    public async Task MinimumChargeMigrationPublishesVersionAndPreservesBookedSnapshot()
    {
        await Sql("""
            UPDATE lot_vehicle_policies SET grace_free_minutes=15 WHERE lot_id=@lot AND vehicle_type='CAR';
            UPDATE pricing_rules r SET parameters='{"blockMinutes":15,"rateVnd":1000,"dailyCapVnd":20000,"multiplier":1}'::jsonb
            FROM pricing_plans p WHERE r.plan_id=p.id AND p.lot_id=@lot AND p.vehicle_type='CAR';
            """, ("lot", Lot));
        var start = DateTimeOffset.UtcNow.AddHours(2);
        var oldBooking = await repository.CreateBookingAsync(Customer,
            new BookingRequest(Lot, Slot, Vehicle, start, start.AddHours(2)), Guid.NewGuid().ToString("N"), Ct);
        Assert.Equal(7000, oldBooking.EstimatedAmount);
        var oldSnapshot = await Scalar($"SELECT s.resolved_rules::text FROM bookings b JOIN pricing_snapshots s ON s.id=b.pricing_snapshot_id WHERE b.id='{oldBooking.Id}'");
        var migration = await File.ReadAllTextAsync(Path.Combine(FindRoot(), "database/services/parking/migrations/012_minimum_charge_10000.sql"));
        await Sql(migration);

        var service = new EstimatedPriceService(new ParkingLotRepository(data), new MinimumCustomer(Customer));
        var estimate = await service.CalculateEstimatedFeeAsync(Lot, "CAR", start.AddHours(3).UtcDateTime, 120);
        Assert.Equal(10000, estimate.TotalFee);
        Assert.Equal(10000, estimate.MinimumChargeVnd);
        var next = await repository.CreateBookingAsync(Customer,
            new BookingRequest(Lot, Slot, Vehicle, start.AddHours(3), start.AddHours(5)), Guid.NewGuid().ToString("N"), Ct);
        Assert.Equal(10000, next.EstimatedAmount);
        var detail = await repository.GetBookingDetailAsync(next.Id, Ct);
        Assert.Equal(10000, detail!.Value.Detail.MinimumChargeVnd);
        Assert.Equal(7000m, await Scalar($"SELECT estimated_amount FROM bookings WHERE id='{oldBooking.Id}'"));
        Assert.Equal(oldSnapshot, await Scalar($"SELECT s.resolved_rules::text FROM bookings b JOIN pricing_snapshots s ON s.id=b.pricing_snapshot_id WHERE b.id='{oldBooking.Id}'"));
        var version = await Scalar("SELECT max(version_no) FROM pricing_plans");
        await Sql(migration);
        Assert.Equal(version, await Scalar("SELECT max(version_no) FROM pricing_plans"));
    }

    private sealed record MinimumCustomer(Guid? UserId) : ICurrentPricingCustomer;
}
