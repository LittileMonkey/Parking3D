using System;
using Parking.Parking.Application;
using Parking.Pricing;
using Xunit;

namespace Parking.Microservices.Tests;

/// <summary>
/// Bộ kiểm thử tích hợp CheckOutFee với PricingEngine (BuildingBlocks).
/// Kiểm chứng toàn bộ quy tắc nghiệp vụ theo Baseline V4:
/// - Khách vãng lai: 60p đầu, block 15p sau, giờ cao điểm 1.2x, Daily Cap, giảm giá Gold Star 10%.
/// - Khách đặt chỗ trước: ra đúng giờ 0đ, ra trễ tính block 15p (không tính lại block đầu 60p),
///   bù trừ trần ngày (Daily Cap) và chiết khấu Gold Star.
/// </summary>
public class CheckOutPricingEngineTests
{
    [Theory]
    [InlineData(12, 0, 7500)]
    [InlineData(23, 50, 15000)]
    public void FlatBlockOvertimeSplitsAtLocalMidnight(int hour, int minute, decimal expectedFee)
    {
        var expectedExit = new DateTimeOffset(2026, 11, 14, hour, minute, 0, TimeSpan.FromHours(7));
        const string rules = """{"blockMinutes":15,"rateVnd":7500,"dailyCapVnd":120000,"multiplier":1}""";
        var fee = CheckOutFee.Calculate(true, expectedExit.AddHours(-1), expectedExit,
            expectedExit.AddSeconds(899), rules, "Asia/Ho_Chi_Minh", expectedExit.AddHours(-1));
        Assert.Equal(expectedFee, fee);
    }

    private static readonly TimeZoneInfo VnTz = TimeZoneInfo.TryFindSystemTimeZoneById("Asia/Ho_Chi_Minh", out var tz)
        ? tz
        : (TimeZoneInfo.TryFindSystemTimeZoneById("SE Asia Standard Time", out var winTz) ? winTz : TimeZoneInfo.Utc);

    private const string FullPolicyJson = """
        {
            "initialBlockMinutes": 60,
            "initialRateVnd": 20000,
            "subsequentBlockMinutes": 15,
            "subsequentRateVnd": 5000,
            "dailyCapVnd": 150000,
            "peakMultiplier": 1.2,
            "peak1Start": "11:30",
            "peak1End": "13:00",
            "peak2Start": "17:30",
            "peak2End": "19:00",
            "goldStarDiscountRate": 0.10
        }
        """;

    private const string FlatBlockLegacyJson = """
        {
            "blockMinutes": 15,
            "rateVnd": 5000,
            "dailyCapVnd": 120000,
            "multiplier": 1.0
        }
        """;

    #region 1. Khách Vãng Lai (Walk-in: hasBooking = false)

    [Fact]
    public void WalkIn_WithinFirst60Minutes_ChargesInitialRateOnly()
    {
        // Xe vào 08:00, ra 08:45 (45 phút <= 60 phút đầu)
        var entry = DateTimeOffset.Parse("2026-11-01T08:00:00+07:00");
        var exit = entry.AddMinutes(45);

        var fee = CheckOutFee.Calculate(
            hasBooking: false,
            entryAt: entry,
            expectedExitAt: exit,
            pricedAt: exit,
            rulesJson: FullPolicyJson,
            timezone: VnTz.Id);

        // Chỉ tính 1 block khởi đầu 20.000 đ
        Assert.Equal(20_000, fee);
    }

    [Fact]
    public void WalkIn_90MinutesOutsidePeak_ChargesInitialPlusTwoSubsequentBlocks()
    {
        // Xe vào 08:00, ra 09:30 (60p đầu 20k + 2 block 15p x 5k = 30k)
        var entry = DateTimeOffset.Parse("2026-11-01T08:00:00+07:00");
        var exit = entry.AddMinutes(90);

        var fee = CheckOutFee.Calculate(
            hasBooking: false,
            entryAt: entry,
            expectedExitAt: exit,
            pricedAt: exit,
            rulesJson: FullPolicyJson,
            timezone: VnTz.Id);

        Assert.Equal(30_000, fee);
    }

    [Fact]
    public void WalkIn_SubsequentBlocksDuringPeak_AppliesPeakMultiplier()
    {
        // Xe vào 11:00, ra 12:00:
        // 60p đầu (11:00 - 12:00) tính InitialRate = 20k
        // Đỗ thêm 30 phút (12:00 - 12:30) trong giờ cao điểm trưa (11:30 - 13:00):
        // 2 block 15p x 5.000 x 1.2 = 12.000 đ
        // Tổng: 20k + 12k = 32.000 đ
        var entry = DateTimeOffset.Parse("2026-11-01T11:00:00+07:00");
        var exit = entry.AddMinutes(90);

        var fee = CheckOutFee.Calculate(
            hasBooking: false,
            entryAt: entry,
            expectedExitAt: exit,
            pricedAt: exit,
            rulesJson: FullPolicyJson,
            timezone: VnTz.Id);

        Assert.Equal(32_000, fee);
    }

    [Fact]
    public void WalkIn_GoldStarMember_AppliesTenPercentDiscount()
    {
        // Xe vào 08:00, ra 09:30 (tổng cước thô 30.000 đ)
        // Hội viên Gold Star giảm 10% (3.000 đ) -> Còn 27.000 đ
        var entry = DateTimeOffset.Parse("2026-11-01T08:00:00+07:00");
        var exit = entry.AddMinutes(90);

        var fee = CheckOutFee.Calculate(
            hasBooking: false,
            entryAt: entry,
            expectedExitAt: exit,
            pricedAt: exit,
            rulesJson: FullPolicyJson,
            timezone: VnTz.Id,
            isGoldStarMember: true);

        Assert.Equal(27_000, fee);
    }

    [Fact]
    public void WalkIn_MultiDayStay_AppliesDailyCapPerDay()
    {
        // Đỗ 2 ngày liên tiếp (mỗi ngày đỗ trên 15 tiếng -> vượt DailyCap 150k mỗi ngày)
        // Tổng tiền = 150k + 150k = 300.000 đ
        var entry = DateTimeOffset.Parse("2026-11-01T06:00:00+07:00");
        var exit = DateTimeOffset.Parse("2026-11-02T22:00:00+07:00");

        var fee = CheckOutFee.Calculate(
            hasBooking: false,
            entryAt: entry,
            expectedExitAt: exit,
            pricedAt: exit,
            rulesJson: FullPolicyJson,
            timezone: VnTz.Id);

        Assert.Equal(300_000, fee);
    }

    #endregion

    #region 2. Khách Đặt Chỗ Trước (Pre-booking: hasBooking = true)

    [Fact]
    public void PreBooking_ExitsOnOrBeforeExpectedTime_ChargesZero()
    {
        // Khách đặt từ 08:00 đến 10:00, xuất bãi lúc 09:50 (sớm 10p)
        var start = DateTimeOffset.Parse("2026-11-01T08:00:00+07:00");
        var expectedExit = DateTimeOffset.Parse("2026-11-01T10:00:00+07:00");
        var actualExit = DateTimeOffset.Parse("2026-11-01T09:50:00+07:00");

        var fee = CheckOutFee.Calculate(
            hasBooking: true,
            entryAt: start,
            expectedExitAt: expectedExit,
            pricedAt: actualExit,
            rulesJson: FullPolicyJson,
            timezone: VnTz.Id,
            bookedStart: start);

        Assert.Equal(0, fee);
    }

    [Fact]
    public void PreBooking_Overtime_ChargesSubsequentBlocksWithoutChargingInitialRateAgain()
    {
        // Khách đặt từ 08:00 đến 10:00 (đã trả cước gồm block đầu 60p + các block sau)
        // Ra trễ 30 phút (10:30):
        // 30 phút quá giờ này ngoài giờ cao điểm -> 2 block 15p x 5.000 đ = 10.000 đ
        // Tuyệt đối không được tính lại 20k của block đầu 60 phút
        var start = DateTimeOffset.Parse("2026-11-01T08:00:00+07:00");
        var expectedExit = DateTimeOffset.Parse("2026-11-01T10:00:00+07:00");
        var actualExit = expectedExit.AddMinutes(30);

        var fee = CheckOutFee.Calculate(
            hasBooking: true,
            entryAt: start,
            expectedExitAt: expectedExit,
            pricedAt: actualExit,
            rulesJson: FullPolicyJson,
            timezone: VnTz.Id,
            bookedStart: start);

        Assert.Equal(10_000, fee);
    }

    [Fact]
    public void PreBooking_OvertimeDuringPeak_AppliesPeakMultiplierToOvertimeBlocks()
    {
        // Khách đặt từ 09:30 đến 11:30 (kết thúc đúng lúc bắt đầu giờ cao điểm trưa)
        // Xuất bãi trễ 30 phút (12:00) -> 30 phút quá giờ hoàn toàn nằm trong cao điểm trưa (11:30 - 13:00)
        // 2 block 15p x 5.000 x 1.2 = 12.000 đ
        var start = DateTimeOffset.Parse("2026-11-01T09:30:00+07:00");
        var expectedExit = DateTimeOffset.Parse("2026-11-01T11:30:00+07:00");
        var actualExit = expectedExit.AddMinutes(30);

        var fee = CheckOutFee.Calculate(
            hasBooking: true,
            entryAt: start,
            expectedExitAt: expectedExit,
            pricedAt: actualExit,
            rulesJson: FullPolicyJson,
            timezone: VnTz.Id,
            bookedStart: start);

        Assert.Equal(12_000, fee);
    }

    [Fact]
    public void PreBooking_OvertimeWithGoldStarMember_AppliesTenPercentDiscountToOvertime()
    {
        // Khách đặt từ 08:00 đến 10:00, quá giờ 30 phút (cước phụ trội thô 10.000 đ)
        // Hội viên Gold Star được giảm 10% (1.000 đ) -> Phụ phí chỉ còn 9.000 đ
        var start = DateTimeOffset.Parse("2026-11-01T08:00:00+07:00");
        var expectedExit = DateTimeOffset.Parse("2026-11-01T10:00:00+07:00");
        var actualExit = expectedExit.AddMinutes(30);

        var fee = CheckOutFee.Calculate(
            hasBooking: true,
            entryAt: start,
            expectedExitAt: expectedExit,
            pricedAt: actualExit,
            rulesJson: FullPolicyJson,
            timezone: VnTz.Id,
            bookedStart: start,
            isGoldStarMember: true);

        Assert.Equal(9_000, fee);
    }

    [Fact]
    public void PreBooking_WhenBookingAlreadyHitDailyCap_OvertimeFeeIsZeroForSameDay()
    {
        // Khách đặt từ 06:00 đến 20:00 (14 tiếng, đã chạm DailyCap 150.000 đ)
        // Xuất bãi trễ thêm 1 tiếng (21:00 cùng ngày)
        // Vì trong ngày đó khách đã trả kịch trần Daily Cap 150k nên không thu thêm
        var start = DateTimeOffset.Parse("2026-11-01T06:00:00+07:00");
        var expectedExit = DateTimeOffset.Parse("2026-11-01T20:00:00+07:00");
        var actualExit = expectedExit.AddHours(1);

        var fee = CheckOutFee.Calculate(
            hasBooking: true,
            entryAt: start,
            expectedExitAt: expectedExit,
            pricedAt: actualExit,
            rulesJson: FullPolicyJson,
            timezone: VnTz.Id,
            bookedStart: start);

        Assert.Equal(0, fee);
    }

    [Fact]
    public void PreBooking_ShortBookingLessThanInitialBlock_ChargesSubsequentOvertimeBlocks()
    {
        // Đặt chỗ 30 phút (08:00 -> 08:30), nhỏ hơn initialBlockMinutes = 60.
        // Xuất bãi 09:00 (trễ 30 phút -> 2 block 15p = 10.000đ).
        var start = DateTimeOffset.Parse("2026-11-01T08:00:00+07:00");
        var expectedExit = DateTimeOffset.Parse("2026-11-01T08:30:00+07:00");
        var actualExit = expectedExit.AddMinutes(30);

        var fee = CheckOutFee.Calculate(
            hasBooking: true,
            entryAt: start,
            expectedExitAt: expectedExit,
            pricedAt: actualExit,
            rulesJson: FullPolicyJson,
            timezone: VnTz.Id,
            bookedStart: start);

        Assert.Equal(10_000, fee);
    }

    [Fact]
    public void PreBooking_EarlyMorningShortBookingCrossingMidnight_ChargesSubsequentOvertimeBlocks()
    {
        // Đặt chỗ 30 phút đầu ngày (00:10 -> 00:40), lùi 60p sẽ sang ngày hôm trước.
        // Xuất bãi 00:55 (trễ 15 phút -> 1 block 15p = 5.000đ).
        var start = DateTimeOffset.Parse("2026-11-01T00:10:00+07:00");
        var expectedExit = DateTimeOffset.Parse("2026-11-01T00:40:00+07:00");
        var actualExit = expectedExit.AddMinutes(15);

        var fee = CheckOutFee.Calculate(
            hasBooking: true,
            entryAt: start,
            expectedExitAt: expectedExit,
            pricedAt: actualExit,
            rulesJson: FullPolicyJson,
            timezone: VnTz.Id,
            bookedStart: start);

        Assert.Equal(5_000, fee);
    }

    #endregion

    #region 3. Khả năng tương thích ngược & Phân tích cấu hình (Backward Compatibility)

    [Fact]
    public void ParsePolicy_BackwardCompatibleWithFlatBlockLegacyJson()
    {
        var policy = CheckOutFee.ParsePolicy(FlatBlockLegacyJson);

        Assert.Equal(15, policy.InitialBlockMinutes);
        Assert.Equal(5000, policy.InitialRateVnd);
        Assert.Equal(15, policy.SubsequentBlockMinutes);
        Assert.Equal(5000, policy.SubsequentRateVnd);
        Assert.Equal(120_000, policy.DailyCapVnd);
        Assert.Equal(1.0m, policy.PeakMultiplier);
    }

    [Fact]
    public void ParsePolicy_FlatBlockLegacyWithoutMultiplier_DefaultsPeakMultiplierToOne()
    {
        const string legacyNoMultiplierJson = """
            {
                "blockMinutes": 15,
                "rateVnd": 5000,
                "dailyCapVnd": 120000
            }
            """;

        var policy = CheckOutFee.ParsePolicy(legacyNoMultiplierJson);

        Assert.Equal(1.0m, policy.PeakMultiplier);
    }

    [Fact]
    public void ParsePolicy_ThrowsWhenRulesJsonIsEmpty()
    {
        Assert.Throws<ArgumentException>(() => CheckOutFee.ParsePolicy(""));
    }

    [Fact]
    public void ResolveTimeZone_ResolvesUtcAndLocalTimezones()
    {
        var utcZone = CheckOutFee.ResolveTimeZone("UTC");
        Assert.Equal(TimeZoneInfo.Utc, utcZone);

        var vnZone = CheckOutFee.ResolveTimeZone(VnTz.Id);
        Assert.NotNull(vnZone);
    }

    #endregion
}

