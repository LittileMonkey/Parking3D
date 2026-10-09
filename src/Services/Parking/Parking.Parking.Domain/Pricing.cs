namespace Parking.Parking.Domain;

public sealed record BlockPrice(int BlockMinutes, long RateVnd, long DailyCapVnd, decimal Multiplier)
{
    public void Validate()
    {
        if (BlockMinutes <= 0 || RateVnd < 0 || DailyCapVnd < 0 || Multiplier < 1)
            throw new ArgumentException("Invalid block price");
    }

    public long Estimate(DateTimeOffset start, DateTimeOffset end, TimeZoneInfo timezone)
    {
        Validate(); if (end <= start) throw new ArgumentException("Invalid parking interval");
        decimal total = 0; var cursor = start;
        while (cursor < end)
        {
            var local = TimeZoneInfo.ConvertTime(cursor, timezone);
            var nextDate = DateTime.SpecifyKind(local.Date.AddDays(1), DateTimeKind.Unspecified);
            // Ambiguous/invalid midnight is rejected rather than silently inventing an offset.
            if (timezone.IsInvalidTime(nextDate) || timezone.IsAmbiguousTime(nextDate))
                throw new ArgumentException("Unsupported local midnight; pricing timezone requires review");
            var midnight = new DateTimeOffset(TimeZoneInfo.ConvertTimeToUtc(nextDate, timezone));
            var stop = end < midnight ? end : midnight;
            var blocks = decimal.Ceiling((decimal)(stop - cursor).Ticks / TimeSpan.FromMinutes(BlockMinutes).Ticks);
            total += Math.Min(blocks * RateVnd * Multiplier, DailyCapVnd);
            cursor = stop;
        }
        return checked((long)decimal.Ceiling(total));
    }
}

public static class SearchMath
{
    public static double Haversine(double lat1, double lon1, double lat2, double lon2)
    {
        if (lat1 is < -90 or > 90 || lat2 is < -90 or > 90 || lon1 is < -180 or > 180 || lon2 is < -180 or > 180)
            throw new ArgumentException("Invalid GPS");
        const double radius = 6371000; const double r = Math.PI / 180;
        var a = Math.Pow(Math.Sin((lat2-lat1)*r/2),2) + Math.Cos(lat1*r)*Math.Cos(lat2*r)*Math.Pow(Math.Sin((lon2-lon1)*r/2),2);
        return 2*radius*Math.Asin(Math.Sqrt(Math.Clamp(a,0,1)));
    }
}

public static class PaymentDecision
{
    public static string ForBooking(string state, bool holdExpired, long paid, long quote, bool reservationAvailable) =>
        state != "PENDING_PAYMENT" ? "RECONCILIATION_REQUIRED" : holdExpired || !reservationAvailable ? "LATE_PAYMENT_RECONCILIATION"
        : paid < quote ? "PARTIAL_PAYMENT" : paid == quote ? "CONFIRMED" : "OVERPAYMENT_RECONCILIATION";
}
