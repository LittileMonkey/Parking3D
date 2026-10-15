namespace Parking.Parking.Domain;

public static class LotOperatingHours
{
    // Intervals are minutes of the local week, Monday 00:00 = 0.
    public static bool Covers(DateTimeOffset startsAt, DateTimeOffset endsAt,
        TimeZoneInfo timezone, IReadOnlyList<(int From, int To)> intervals)
    {
        if (endsAt <= startsAt || endsAt - startsAt > TimeSpan.FromDays(31)) return false;
        for (var instant = startsAt; instant < endsAt;
             instant = instant.AddTicks(TimeSpan.TicksPerMinute - instant.UtcTicks % TimeSpan.TicksPerMinute))
        {
            var local = TimeZoneInfo.ConvertTime(instant, timezone);
            var minute = (((int)local.DayOfWeek + 6) % 7) * 1440 + local.Hour * 60 + local.Minute;
            if (!intervals.Any(interval => minute >= interval.From && minute < interval.To)) return false;
        }
        return true;
    }
}
