using Parking.Pricing;
using Xunit;

namespace Parking.Microservices.Tests;

public sealed class PricingEngineOvertimeTests
{
    private static readonly TimeZoneInfo LotTimeZone = TimeZoneInfo.FindSystemTimeZoneById("Asia/Ho_Chi_Minh");

    private static PricingPolicy StandardPolicy => new(
        InitialBlockMinutes: 60,
        InitialRateVnd: 20_000,
        SubsequentBlockMinutes: 15,
        SubsequentRateVnd: 5_000,
        PeakMultiplier: 1.2m,
        Peak1Start: new TimeOnly(11, 30),
        Peak1End: new TimeOnly(13, 0),
        Peak2Start: new TimeOnly(17, 30),
        Peak2End: new TimeOnly(19, 0),
        DailyCapVnd: 150_000,
        GoldStarDiscountRate: 0.10m);

    [Theory]
    [InlineData(-1L, 0L)]
    [InlineData(0L, 0L)]
    [InlineData(1L, 5_000L)]
    [InlineData(8_990_000_000L, 5_000L)]
    [InlineData(9_000_000_000L, 5_000L)]
    [InlineData(9_000_000_001L, 10_000L)]
    public void OvertimeStartsAtExpectedExitEvenWhenBookingDurationHasMicrosecondDrift(long overtimeTicks, long expected)
    {
        var bookedStart = DateTimeOffset.Parse("2026-11-01T08:00:00+07:00");
        var expectedExit = bookedStart.AddHours(1).AddTicks(50);

        var amount = PricingEngine.CalculateOvertime(bookedStart, expectedExit,
            expectedExit.AddTicks(overtimeTicks), StandardPolicy, false, LotTimeZone);

        Assert.Equal(expected, amount);
    }

    [Fact]
    public void ShortBookingOvertimeUsesSubsequentRateWithoutAnotherInitialBlock()
    {
        var bookedStart = DateTimeOffset.Parse("2026-11-01T08:00:00+07:00");
        var expectedExit = bookedStart.AddMinutes(30);

        var amount = PricingEngine.CalculateOvertime(bookedStart, expectedExit,
            expectedExit.AddMinutes(15), StandardPolicy, false, LotTimeZone);

        Assert.Equal(5_000, amount);
    }

    [Fact]
    public void OvertimeDuringLotPeakHoursUsesThePeakMultiplier()
    {
        var bookedStart = DateTimeOffset.Parse("2026-11-01T09:30:00+07:00");
        var expectedExit = bookedStart.AddHours(2);

        var amount = PricingEngine.CalculateOvertime(bookedStart, expectedExit,
            expectedExit.AddMinutes(30), StandardPolicy, false, LotTimeZone);

        Assert.Equal(12_000, amount);
    }

    [Theory]
    [InlineData(false, 5_000L)]
    [InlineData(true, 4_500L)]
    public void OvertimeOnlyUsesTheRemainingDailyCapBeforeApplyingMembershipDiscount(bool isGoldStarMember, long expected)
    {
        var bookedStart = DateTimeOffset.Parse("2026-11-01T08:00:00+07:00");
        var expectedExit = bookedStart.AddHours(1);
        var policy = StandardPolicy with { DailyCapVnd = 25_000 };

        var amount = PricingEngine.CalculateOvertime(bookedStart, expectedExit,
            expectedExit.AddMinutes(30), policy, isGoldStarMember, LotTimeZone);

        Assert.Equal(expected, amount);
    }

    [Fact]
    public void BookingAlreadyAtDailyCapHasNoOvertimeChargeOnTheSameDay()
    {
        var bookedStart = DateTimeOffset.Parse("2026-11-01T08:00:00+07:00");
        var expectedExit = bookedStart.AddMinutes(75);
        var policy = StandardPolicy with { DailyCapVnd = 25_000 };

        var amount = PricingEngine.CalculateOvertime(bookedStart, expectedExit,
            expectedExit.AddHours(1), policy, false, LotTimeZone);

        Assert.Equal(0, amount);
    }

    [Theory]
    [InlineData(false, 5_000L)]
    [InlineData(true, 4_500L)]
    public void OvertimeGetsANewDailyCapAtLotLocalMidnightWithoutAnotherInitialBlock(bool isGoldStarMember, long expected)
    {
        var bookedStart = DateTimeOffset.Parse("2026-11-01T22:45:00+07:00");
        var expectedExit = bookedStart.AddHours(1);
        var policy = StandardPolicy with { DailyCapVnd = 20_000 };

        var amount = PricingEngine.CalculateOvertime(bookedStart, expectedExit,
            expectedExit.AddMinutes(30), policy, isGoldStarMember, LotTimeZone);

        Assert.Equal(expected, amount);
    }

    [Fact]
    public void MembershipRoundingUsesTheDifferenceBetweenTotalAndBookedNetAmounts()
    {
        var bookedStart = DateTimeOffset.Parse("2026-11-01T08:00:00+07:00");
        var expectedExit = bookedStart.AddHours(1);
        var policy = StandardPolicy with { InitialRateVnd = 20_005, SubsequentRateVnd = 5_005 };

        var amount = PricingEngine.CalculateOvertime(bookedStart, expectedExit,
            expectedExit.AddMinutes(15), policy, true, LotTimeZone);

        // Booked net: 20,005 - 2,001 = 18,004; total net: 25,010 - 2,501 = 22,509.
        Assert.Equal(4_505, amount);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-15)]
    public void InvalidBookingWindowIsRejected(int bookedMinutes)
    {
        var bookedStart = DateTimeOffset.Parse("2026-11-01T08:00:00+07:00");
        var expectedExit = bookedStart.AddMinutes(bookedMinutes);

        Assert.Throws<ArgumentException>(() => PricingEngine.CalculateOvertime(bookedStart, expectedExit,
            expectedExit.AddMinutes(15), StandardPolicy, false, LotTimeZone));
    }

    [Fact]
    public void InvalidPricingPolicyIsRejected()
    {
        var bookedStart = DateTimeOffset.Parse("2026-11-01T08:00:00+07:00");
        var expectedExit = bookedStart.AddHours(1);
        var policy = StandardPolicy with { SubsequentBlockMinutes = 0 };

        Assert.Throws<ArgumentException>(() => PricingEngine.CalculateOvertime(bookedStart, expectedExit,
            expectedExit.AddMinutes(15), policy, false, LotTimeZone));
    }
}
