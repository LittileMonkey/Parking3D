using Parking.Parking.Application.Interfaces;
using Parking.Parking.Domain.Entities;
using Parking.Parking.Infrastructure.Services;
using Microsoft.AspNetCore.Http;
using System.Security.Claims;
using Xunit;

namespace Parking.Microservices.Tests;

public sealed class BookingPriceConsistencyTests
{
    [Fact]
    public void PricingCustomerIgnoresQueryAndHeaderIdentityAndRequiresAuthenticatedClaims()
    {
        var id = Guid.NewGuid();
        var http = new DefaultHttpContext();
        http.Request.QueryString = new QueryString("?customerId=" + id);
        http.Request.Headers["X-User-Id"] = id.ToString();
        http.User = new ClaimsPrincipal(new ClaimsIdentity([new Claim("sub", id.ToString())]));
        var customer = new CurrentPricingCustomer(new HttpContextAccessor { HttpContext = http });
        Assert.Null(customer.UserId);
        http.User = new ClaimsPrincipal(new ClaimsIdentity([new Claim("sub", id.ToString())], "validated-test-token"));
        Assert.Equal(id, customer.UserId);
    }

    [Theory]
    [InlineData(true, 15, 7000)]
    [InlineData(true, 0, 8000)]
    [InlineData(false, 15, 8000)]
    public async Task TwoHourMotorbikeEstimateUsesOnlyTheCurrentCustomersAvailableDailyGrace(
        bool signedIn, int availableGrace, long expected)
    {
        var user = signedIn ? Guid.NewGuid() : (Guid?)null;
        var repo = new PricingRepository { AvailableGrace = availableGrace };
        var service = new EstimatedPriceService(repo, new Customer(user));
        var start = new DateTime(2026, 11, 21, 8, 12, 0, DateTimeKind.Utc);

        var result = await service.CalculateEstimatedFeeAsync(Guid.NewGuid(), "MOTORBIKE", start, 120);

        Assert.Equal(expected, result.TotalFee);
        Assert.Equal(signedIn ? 1 : 0, repo.GraceLookups);
        Assert.Equal(user, repo.LastUser);
        if (signedIn && availableGrace > 0) Assert.Contains("15", result.Details);
    }

    [Fact]
    public async Task GraceEligibilityIsRecheckedForEveryEstimateRatherThanCachedByLot()
    {
        var repo = new PricingRepository { AvailableGrace = 15 };
        var service = new EstimatedPriceService(repo, new Customer(Guid.NewGuid()));
        var lot = Guid.NewGuid();
        var start = new DateTime(2026, 11, 21, 8, 12, 0, DateTimeKind.Utc);

        Assert.Equal(7000, (await service.CalculateEstimatedFeeAsync(lot, "MOTORBIKE", start, 120)).TotalFee);
        repo.AvailableGrace = 0;
        Assert.Equal(8000, (await service.CalculateEstimatedFeeAsync(lot, "MOTORBIKE", start, 120)).TotalFee);
        Assert.Equal(2, repo.GraceLookups);
    }

    private sealed record Customer(Guid? UserId) : ICurrentPricingCustomer;

    private sealed class PricingRepository : IParkingLotRepository
    {
        public int AvailableGrace { get; set; }
        public int GraceLookups { get; private set; }
        public Guid? LastUser { get; private set; }
        public Task<List<ParkingLot>> GetAvailableLotsAsync(string vehicleType, CancellationToken cancellationToken = default)
            => Task.FromResult(new List<ParkingLot>());
        public Task<(string Timezone, string ParametersJson)?> GetPricingRuleConfigAsync(
            Guid lotId, string vehicleType, DateTime startTime, CancellationToken cancellationToken = default)
            => Task.FromResult<(string, string)?>(
                ("Asia/Ho_Chi_Minh", """{"blockMinutes":15,"rateVnd":1000,"dailyCapVnd":20000,"multiplier":1}"""));
        public Task<int> GetAvailableGraceMinutesAsync(Guid lotId, string vehicleType, DateTimeOffset startsAt,
            Guid customerId, CancellationToken cancellationToken = default)
        {
            GraceLookups++;
            LastUser = customerId;
            return Task.FromResult(AvailableGrace);
        }
    }
}
