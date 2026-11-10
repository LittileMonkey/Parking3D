using System;
using System.Text.Json;
using Parking.Pricing;

namespace Parking.Parking.Domain;

/// <summary>
/// Domain Service chịu trách nhiệm tính toán tiền cước đỗ xe khi xuất bãi (Check-Out).
/// Tích hợp trực tiếp PricingEngine dùng chung từ BuildingBlocks (Parking.PricingEngine)
/// để bảo đảm đồng nhất 100% công thức tính tiền cước giữa Parking Service và Payment Service.
/// </summary>
public static class CheckOutFee
{
    /// <summary>
    /// Tính cước xe xuất bãi.
    /// - Khách vãng lai (!hasBooking): Tính toàn bộ thời gian từ entryAt đến pricedAt qua PricingEngine.
    /// - Khách đặt trước (hasBooking):
    ///   + Nếu pricedAt &lt;= expectedExitAt: Ra đúng giờ hoặc ra sớm -> 0 VNĐ.
    ///   + Nếu pricedAt &gt; expectedExitAt: Ra trễ -> Tính phụ phí quá giờ (Overtime Fee) bù trừ vào ngày hôm đó.
    /// </summary>
    public static long Calculate(
        bool hasBooking,
        DateTimeOffset entryAt,
        DateTimeOffset expectedExitAt,
        DateTimeOffset pricedAt,
        string rulesJson,
        string timezone,
        DateTimeOffset? bookedStart = null,
        bool isGoldStarMember = false)
    {
        var start = hasBooking ? expectedExitAt : entryAt;
        if (pricedAt <= start) return 0;

        var policy = ParsePolicy(rulesJson);
        var zone = ResolveTimeZone(timezone);

        // 1. Khách vãng lai (Walk-in): Tính cước toàn bộ thời gian gửi xe
        if (!hasBooking)
        {
            var result = PricingEngine.Calculate(entryAt, pricedAt, policy, isGoldStarMember, zone);
            return result.FinalNetAmountVnd;
        }

        // 2. Khách đặt chỗ trước (Pre-booking):
        // Khách đã trả trước cước đặt chỗ cho khoảng [bookedStart, expectedExitAt].
        // Phụ phí quá giờ = Cước toàn bộ hành trình - Cước khoảng thời gian đã đặt trước.
        // Công thức này tự động bóc tách ranh giới nửa đêm, xét khung giờ cao điểm và bảo vệ trần ngày (Daily Cap).
        var effectiveStart = bookedStart.HasValue && bookedStart.Value < entryAt ? bookedStart.Value : entryAt;
        if (effectiveStart >= expectedExitAt)
            effectiveStart = expectedExitAt.AddMinutes(-policy.SubsequentBlockMinutes);

        var fullResult = PricingEngine.Calculate(effectiveStart, pricedAt, policy, isGoldStarMember, zone);
        var bookedResult = PricingEngine.Calculate(effectiveStart, expectedExitAt, policy, isGoldStarMember, zone);

        return Math.Max(0, fullResult.FinalNetAmountVnd - bookedResult.FinalNetAmountVnd);
    }

    /// <summary>
    /// Chuyển đổi JSON snapshot quy tắc giá (resolved_rules) thành Value Object PricingPolicy.
    /// Hỗ trợ cả định dạng JSON Flat Block cũ và JSON PricingPolicy mở rộng.
    /// </summary>
    public static PricingPolicy ParsePolicy(string rulesJson)
    {
        if (string.IsNullOrWhiteSpace(rulesJson))
            throw new ArgumentException("A valid pricing snapshot is required.", nameof(rulesJson));

        using var doc = JsonDocument.Parse(rulesJson);
        var root = doc.RootElement;

        // Block tiếp theo (Subsequent Block)
        int subsequentMinutes = root.TryGetProperty("subsequentBlockMinutes", out var sbm) ? sbm.GetInt32()
            : (root.TryGetProperty("blockMinutes", out var bm) ? bm.GetInt32() : 15);
        if (subsequentMinutes <= 0) subsequentMinutes = 15;

        long subsequentRate = root.TryGetProperty("subsequentRateVnd", out var srv) ? srv.GetInt64()
            : (root.TryGetProperty("rateVnd", out var rv) ? rv.GetInt64() : 5000);
        if (subsequentRate < 0) subsequentRate = 0;

        // Block khởi đầu (Initial Block)
        int initialMinutes = root.TryGetProperty("initialBlockMinutes", out var ibm) ? ibm.GetInt32() : subsequentMinutes;
        if (initialMinutes <= 0) initialMinutes = subsequentMinutes;

        long initialRate = root.TryGetProperty("initialRateVnd", out var irv) ? irv.GetInt64() : subsequentRate;
        if (initialRate < 0) initialRate = 0;

        // Mức trần ngày (Daily Cap)
        long dailyCap = root.TryGetProperty("dailyCapVnd", out var dc) ? dc.GetInt64() : 150000;
        if (dailyCap < 0) dailyCap = 0;

        // Hệ số nhân giờ cao điểm (Peak Multiplier >= 1.0)
        decimal multiplier = root.TryGetProperty("peakMultiplier", out var pm) ? (decimal)pm.GetDouble()
            : (root.TryGetProperty("multiplier", out var m) ? (decimal)m.GetDouble() : 1.2m);
        if (multiplier < 1.0m) multiplier = 1.0m;

        // Khung giờ cao điểm trưa (Peak 1: 11:30 - 13:00)
        var peak1Start = root.TryGetProperty("peak1Start", out var p1s) && TimeOnly.TryParse(p1s.GetString(), out var t1s) ? t1s : new TimeOnly(11, 30);
        var peak1End = root.TryGetProperty("peak1End", out var p1e) && TimeOnly.TryParse(p1e.GetString(), out var t1e) ? t1e : new TimeOnly(13, 0);
        if (peak1End <= peak1Start) peak1End = peak1Start.AddHours(1.5);

        // Khung giờ cao điểm chiều (Peak 2: 17:30 - 19:00)
        var peak2Start = root.TryGetProperty("peak2Start", out var p2s) && TimeOnly.TryParse(p2s.GetString(), out var t2s) ? t2s : new TimeOnly(17, 30);
        var peak2End = root.TryGetProperty("peak2End", out var p2e) && TimeOnly.TryParse(p2e.GetString(), out var t2e) ? t2e : new TimeOnly(19, 0);
        if (peak2End <= peak2Start) peak2End = peak2Start.AddHours(1.5);

        // Chiết khấu hội viên Gold Star (0.0 đến 1.0, mặc định 10% = 0.10)
        decimal goldStarDiscount = root.TryGetProperty("goldStarDiscountRate", out var gs) ? (decimal)gs.GetDouble() : 0.10m;
        if (goldStarDiscount is < 0.0m or > 1.0m) goldStarDiscount = 0.10m;

        var policy = new PricingPolicy(
            InitialBlockMinutes: initialMinutes,
            InitialRateVnd: initialRate,
            SubsequentBlockMinutes: subsequentMinutes,
            SubsequentRateVnd: subsequentRate,
            PeakMultiplier: multiplier,
            Peak1Start: peak1Start,
            Peak1End: peak1End,
            Peak2Start: peak2Start,
            Peak2End: peak2End,
            DailyCapVnd: dailyCap,
            GoldStarDiscountRate: goldStarDiscount
        );

        policy.Validate();
        return policy;
    }

    /// <summary>
    /// Chuẩn hóa và tìm kiếm TimeZoneInfo hỗ trợ cả hệ điều hành Windows ("SE Asia Standard Time")
    /// và Linux / Docker ("Asia/Ho_Chi_Minh").
    /// </summary>
    public static TimeZoneInfo ResolveTimeZone(string timezone)
    {
        if (string.IsNullOrWhiteSpace(timezone))
            throw new ArgumentException("Múi giờ không được để trống.", nameof(timezone));

        if (TimeZoneInfo.TryFindSystemTimeZoneById(timezone, out var zone))
            return zone;

        if (timezone.Equals("Asia/Ho_Chi_Minh", StringComparison.OrdinalIgnoreCase) &&
            TimeZoneInfo.TryFindSystemTimeZoneById("SE Asia Standard Time", out var winZone))
            return winZone;

        if (timezone.Equals("SE Asia Standard Time", StringComparison.OrdinalIgnoreCase) &&
            TimeZoneInfo.TryFindSystemTimeZoneById("Asia/Ho_Chi_Minh", out var linuxZone))
            return linuxZone;

        return TimeZoneInfo.FindSystemTimeZoneById(timezone);
    }
}
