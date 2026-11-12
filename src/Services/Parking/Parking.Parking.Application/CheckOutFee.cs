using System;
using System.Text.Json;
using Parking.Pricing;
using Parking.Parking.Domain;

namespace Parking.Parking.Application;

/// <summary>
/// Adapts Parking snapshots and session times to the shared PricingEngine
/// and the legacy flat-block pricing rules stored in older snapshots.
/// </summary>
public static class CheckOutFee
{
    /// <summary>
    /// Calculates the check-out amount due.
    /// - Walk-in (<paramref name="hasBooking"/> == false): full duration [entryAt, pricedAt].
    /// - Pre-booking (<paramref name="hasBooking"/> == true): 0 VND at or before expectedExitAt;
    ///   subsequent-block overtime (never re-charging the initial block) when exiting late,
    ///   honoring peak multipliers, daily caps, midnight boundaries, and Gold Star discounts.
    /// </summary>
    public static long Calculate(
        bool hasBooking,
        DateTimeOffset entryAt,
        DateTimeOffset expectedExitAt,
        DateTimeOffset pricedAt,
        string rulesJson,
        string timezone,
        DateTimeOffset? bookedStart = null,
        bool isGoldStarMember = false, int graceMinutes = 0)
    {
        if(graceMinutes is < 0 or > 15)throw new ArgumentException("Invalid grace snapshot");
        entryAt=entryAt.AddMinutes(graceMinutes);bookedStart=bookedStart?.AddMinutes(graceMinutes);
        var start = hasBooking ? expectedExitAt : entryAt;
        if (pricedAt <= start) return 0;

        // Flat-block snapshots must use the same calculation as search and booking.
        // Otherwise the legacy multiplier is applied only at checkout peak hours.
        using var snapshot = JsonDocument.Parse(rulesJson);
        if (snapshot.RootElement.TryGetProperty("blockMinutes", out _) &&
            !snapshot.RootElement.TryGetProperty("initialBlockMinutes", out _))
        {
            var flat = JsonSerializer.Deserialize<BlockPrice>(rulesJson, new JsonSerializerOptions { PropertyNameCaseInsensitive = true })!;
            var tz = ResolveTimeZone(timezone);
            if (!hasBooking) return flat.Estimate(entryAt, pricedAt, tz);
            var beginning = bookedStart ?? entryAt;
            if (beginning >= expectedExitAt) beginning = expectedExitAt.AddMinutes(-flat.BlockMinutes);
            return flat.EstimateOvertime(beginning, expectedExitAt, pricedAt, tz);
        }

        var policy = ParsePolicy(rulesJson);
        var zone = ResolveTimeZone(timezone);

        if (!hasBooking)
        {
            var result = PricingEngine.Calculate(entryAt, pricedAt, policy, isGoldStarMember, zone);
            return result.FinalNetAmountVnd;
        }

        // Prefer the booked window over an early physical entry. Preserve the
        // existing fallback for sessions without a usable booked start.
        var effectiveStart = bookedStart ?? entryAt;
        if (effectiveStart >= expectedExitAt)
            effectiveStart = expectedExitAt.AddMinutes(-policy.SubsequentBlockMinutes);

        return PricingEngine.CalculateOvertime(effectiveStart, expectedExitAt, pricedAt, policy, isGoldStarMember, zone);
    }

    /// <summary>
    /// Parses pricing snapshot resolved_rules JSON into a validated PricingPolicy.
    /// Supports both legacy FLAT_BLOCK JSON and extended V4 PricingPolicy JSON.
    /// </summary>
    public static PricingPolicy ParsePolicy(string rulesJson)
    {
        if (string.IsNullOrWhiteSpace(rulesJson))
            throw new ArgumentException("A valid pricing snapshot is required.", nameof(rulesJson));

        using var doc = JsonDocument.Parse(rulesJson);
        var root = doc.RootElement;

        int subsequentMinutes = root.TryGetProperty("subsequentBlockMinutes", out var sbm) ? sbm.GetInt32()
            : (root.TryGetProperty("blockMinutes", out var bm) ? bm.GetInt32() : 15);
        if (subsequentMinutes <= 0) subsequentMinutes = 15;

        long subsequentRate = root.TryGetProperty("subsequentRateVnd", out var srv) ? srv.GetInt64()
            : (root.TryGetProperty("rateVnd", out var rv) ? rv.GetInt64() : 5000);
        if (subsequentRate < 0) subsequentRate = 0;

        int initialMinutes = root.TryGetProperty("initialBlockMinutes", out var ibm) ? ibm.GetInt32() : subsequentMinutes;
        if (initialMinutes <= 0) initialMinutes = subsequentMinutes;

        long initialRate = root.TryGetProperty("initialRateVnd", out var irv) ? irv.GetInt64() : subsequentRate;
        if (initialRate < 0) initialRate = 0;

        long dailyCap = root.TryGetProperty("dailyCapVnd", out var dc) ? dc.GetInt64() : 150000;
        if (dailyCap < 0) dailyCap = 0;

        bool isLegacyFlatBlock = !root.TryGetProperty("initialBlockMinutes", out _)
            && (root.TryGetProperty("blockMinutes", out _) || root.TryGetProperty("rateVnd", out _));
        decimal defaultMultiplier = isLegacyFlatBlock ? 1.0m : 1.2m;
        decimal multiplier = root.TryGetProperty("peakMultiplier", out var pm) ? (decimal)pm.GetDouble()
            : (root.TryGetProperty("multiplier", out var m) ? (decimal)m.GetDouble() : defaultMultiplier);
        if (multiplier < 1.0m) multiplier = 1.0m;

        var peak1Start = root.TryGetProperty("peak1Start", out var p1s) && TimeOnly.TryParse(p1s.GetString(), out var t1s) ? t1s : new TimeOnly(11, 30);
        var peak1End = root.TryGetProperty("peak1End", out var p1e) && TimeOnly.TryParse(p1e.GetString(), out var t1e) ? t1e : new TimeOnly(13, 0);
        if (peak1End <= peak1Start) peak1End = peak1Start.AddHours(1.5);

        var peak2Start = root.TryGetProperty("peak2Start", out var p2s) && TimeOnly.TryParse(p2s.GetString(), out var t2s) ? t2s : new TimeOnly(17, 30);
        var peak2End = root.TryGetProperty("peak2End", out var p2e) && TimeOnly.TryParse(p2e.GetString(), out var t2e) ? t2e : new TimeOnly(19, 0);
        if (peak2End <= peak2Start) peak2End = peak2Start.AddHours(1.5);

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
            GoldStarDiscountRate: goldStarDiscount);

        policy.Validate();
        return policy;
    }

    /// <summary>
    /// Resolves TimeZoneInfo supporting both Windows and IANA timezone identifiers.
    /// </summary>
    public static TimeZoneInfo ResolveTimeZone(string timezone)
    {
        if (string.IsNullOrWhiteSpace(timezone))
            throw new ArgumentException("Time zone cannot be empty.", nameof(timezone));

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
