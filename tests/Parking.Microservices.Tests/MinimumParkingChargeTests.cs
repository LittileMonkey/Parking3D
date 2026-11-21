using System.Text.Json;
using Parking.Parking.Application;
using Parking.Parking.Domain;
using Parking.Pricing;
using Microsoft.Extensions.Options;
using Microsoft.AspNetCore.WebUtilities;
using Parking.Payment.Infrastructure.Configuration;
using Parking.Payment.Infrastructure.Services;
using Xunit;

namespace Parking.Microservices.Tests;

public sealed class MinimumParkingChargeTests
{
    private static readonly DateTimeOffset Start = new(2026, 11, 21, 8, 0, 0, TimeSpan.Zero);
    private const string Flat = """{"blockMinutes":15,"rateVnd":1000,"dailyCapVnd":20000,"multiplier":1,"minimumChargeVnd":10000}""";
    private const string Extended = """{"initialBlockMinutes":15,"initialRateVnd":1000,"subsequentBlockMinutes":15,"subsequentRateVnd":1000,"dailyCapVnd":20000,"peakMultiplier":1,"goldStarDiscountRate":0.1,"minimumChargeVnd":10000}""";
    private static BlockPrice Price(string json = Flat) => JsonSerializer.Deserialize<BlockPrice>(json,
        new JsonSerializerOptions { PropertyNameCaseInsensitive = true })!;

    [Theory]
    [InlineData(30, 10000)]
    [InlineData(105, 10000)]
    [InlineData(120, 10000)]
    [InlineData(150, 10000)]
    [InlineData(225, 15000)]
    public void FlatFeeHasOneMinimumPerVisit(int minutes, long expected)
        => Assert.Equal(expected, Price().Estimate(Start, Start.AddMinutes(minutes), TimeZoneInfo.Utc));

    [Fact]
    public void LegacySnapshotsWithoutMinimumRetainTheirPromisedAmount()
    {
        var legacy = Price("""{"blockMinutes":15,"rateVnd":1000,"dailyCapVnd":20000,"multiplier":1}""");
        Assert.Equal(7000, legacy.Estimate(Start.AddMinutes(15), Start.AddMinutes(120), TimeZoneInfo.Utc));
    }

    [Theory]
    [InlineData(135, 0)]
    [InlineData(180, 2000)]
    public void PrepaidMinimumIsCreditedAgainstWholeVisitOvertime(int actualMinutes, long expected)
        => Assert.Equal(expected, Price().EstimateOvertime(Start, Start.AddMinutes(120), Start.AddMinutes(actualMinutes), TimeZoneInfo.Utc));

    [Fact]
    public void CrossingMidnightDoesNotApplyAnotherMinimum()
    {
        var entry = new DateTimeOffset(2026, 11, 21, 22, 45, 0, TimeSpan.Zero);
        Assert.Equal(10000, Price().Estimate(entry, entry.AddMinutes(120), TimeZoneInfo.Utc));
        Assert.Equal(3000, Price().EstimateOvertime(entry, entry.AddMinutes(120), entry.AddMinutes(195), TimeZoneInfo.Utc));
    }

    [Fact]
    public void WalkInShorterThanGraceStillHonorsConfiguredMinimumForPositiveVisit()
        => Assert.Equal(10000, CheckOutFee.Calculate(false, Start, Start.AddHours(2), Start.AddMinutes(10),
            Flat, "UTC", graceMinutes: 15));

    [Fact]
    public void PrepaidBookingOnTimeNeverPaysMinimumAgain()
        => Assert.Equal(0, CheckOutFee.Calculate(true, Start, Start.AddHours(2), Start.AddHours(2),
            Flat, "UTC", bookedStart: Start));

    [Fact]
    public void ExtendedEngineAppliesMinimumAfterMembershipDiscount()
    {
        var policy = CheckOutFee.ParsePolicy(Extended);
        Assert.Equal(10000, PricingEngine.Calculate(Start, Start.AddHours(2), policy, true, TimeZoneInfo.Utc).FinalNetAmountVnd);
        Assert.Equal(800, PricingEngine.CalculateOvertime(Start, Start.AddMinutes(90), Start.AddMinutes(180), policy, true, TimeZoneInfo.Utc));
    }

    [Theory]
    [InlineData(-1, 20000)]
    [InlineData(10000, 5000)]
    public void InvalidMinimumOrCapIsRejected(long minimum, long cap)
    {
        var rules = $$"""{"blockMinutes":15,"rateVnd":1000,"dailyCapVnd":{{cap}},"multiplier":1,"minimumChargeVnd":{{minimum}}}""";
        Assert.Throws<ArgumentException>(() => Price(rules).Validate());
    }

    [Fact]
    public void VnPayReceivesExactlyTheAuthoritativeMinimumMultipliedByOneHundred()
    {
        var vnpay = new VnPayService(Options.Create(new VnPaySettings
        {
            TmnCode = "TEST", HashSecret = new string('t', 64),
            BaseUrl = "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
            ReturnUrl = "http://localhost:8080/api/v1/payments/vnpay/return"
        }));
        var amount = Price().Estimate(Start.AddMinutes(15), Start.AddHours(2), TimeZoneInfo.Utc);
        var url = vnpay.CreatePaymentUrl("minimum-test", amount, "Minimum fee test", "127.0.0.1");
        Assert.Equal("1000000", QueryHelpers.ParseQuery(new Uri(url).Query)["vnp_Amount"]);
    }
}
