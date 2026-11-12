namespace Parking.Parking.Domain;

public sealed record BlockPrice(int BlockMinutes, long RateVnd, long DailyCapVnd, decimal Multiplier,
    string? PeakStart = null, string? PeakEnd = null)
{
    public void Validate()
    {
        if (BlockMinutes <= 0 || BlockMinutes > 1440 || RateVnd < 0 || DailyCapVnd < 0 || Multiplier < 1 || Multiplier > 1.5m)
            throw new ArgumentException("Invalid block price");
        if ((PeakStart is null) != (PeakEnd is null) ||
            (PeakStart is not null && (!TimeOnly.TryParse(PeakStart, out _) || !TimeOnly.TryParse(PeakEnd, out _) || PeakStart == PeakEnd)))
            throw new ArgumentException("Invalid peak window");
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
            decimal dayAmount = 0;
            for (var block = cursor; block < stop; block = block.AddMinutes(BlockMinutes))
            {
                var blockEnd = block.AddMinutes(BlockMinutes);
                if (blockEnd > stop) blockEnd = stop;
                var factor = Multiplier;
                if (PeakStart is not null)
                {
                    var peakStart = TimeOnly.Parse(PeakStart); var peakEnd = TimeOnly.Parse(PeakEnd!);
                    var localStart = TimeZoneInfo.ConvertTime(block, timezone).TimeOfDay;
                    var localEnd = TimeZoneInfo.ConvertTime(blockEnd, timezone).TimeOfDay;
                    if (localEnd == TimeSpan.Zero) localEnd = TimeSpan.FromDays(1);
                    var overlaps = peakStart < peakEnd
                        ? localStart < peakEnd.ToTimeSpan() && localEnd > peakStart.ToTimeSpan()
                        : localStart < peakEnd.ToTimeSpan() || localEnd > peakStart.ToTimeSpan();
                    factor = overlaps ? Multiplier : 1;
                }
                dayAmount += RateVnd * factor;
            }
            total += Math.Min(dayAmount, DailyCapVnd);
            cursor = stop;
        }
        return checked((long)decimal.Ceiling(total));
    }

    public long EstimateOvertime(DateTimeOffset bookedStart, DateTimeOffset expectedExit,
        DateTimeOffset actualExit, TimeZoneInfo timezone)
    {
        Validate();
        long total = 0;
        var cursor = expectedExit;
        while (cursor < actualExit)
        {
            var localDate = TimeZoneInfo.ConvertTime(cursor, timezone).Date;
            var midnight = DateTime.SpecifyKind(localDate, DateTimeKind.Unspecified);
            var nextMidnight = midnight.AddDays(1);
            if (timezone.IsInvalidTime(midnight) || timezone.IsAmbiguousTime(midnight) ||
                timezone.IsInvalidTime(nextMidnight) || timezone.IsAmbiguousTime(nextMidnight))
                throw new ArgumentException("Unsupported local midnight; pricing timezone requires review");

            var dayStart = new DateTimeOffset(TimeZoneInfo.ConvertTimeToUtc(midnight, timezone));
            var dayEnd = new DateTimeOffset(TimeZoneInfo.ConvertTimeToUtc(nextMidnight, timezone));
            var stop = actualExit < dayEnd ? actualExit : dayEnd;
            var prepaidStart = bookedStart > dayStart ? bookedStart : dayStart;
            var prepaid = prepaidStart < expectedExit ? Estimate(prepaidStart, expectedExit, timezone) : 0;
            var remainingCap = Math.Max(0, DailyCapVnd - prepaid);
            total = checked(total + Math.Min(remainingCap, Estimate(cursor, stop, timezone)));
            cursor = stop;
        }
        return total;
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
