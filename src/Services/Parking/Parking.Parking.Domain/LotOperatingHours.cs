namespace Parking.Parking.Domain;

// Quy tắc giờ hoạt động, không phụ thuộc HTTP hoặc database.
public static class LotOperatingHours
{
    /// <summary>
    /// Kiểm tra toàn bộ khoảng [bắt đầu, kết thúc) theo giờ địa phương của bãi.
    /// Các khoảng mở cửa tính bằng phút trong tuần, với thứ Hai lúc 00:00 là phút 0.
    /// </summary>
    public static bool Covers(
        DateTimeOffset startsAt,
        DateTimeOffset endsAt,
        TimeZoneInfo timezone,
        IReadOnlyList<(int From, int To)> intervals)
    {
        if (endsAt <= startsAt || endsAt - startsAt > TimeSpan.FromDays(31))
        {
            return false;
        }

        // Kiểm tra thời điểm bắt đầu rồi nhảy đến đầu phút tiếp theo.
        for (var instant = startsAt; instant < endsAt;
             instant = instant.AddTicks(TimeSpan.TicksPerMinute - instant.UtcTicks % TimeSpan.TicksPerMinute))
        {
            var localTime = TimeZoneInfo.ConvertTime(instant, timezone);
            var dayIndex = ((int)localTime.DayOfWeek + 6) % 7;
            var minuteOfWeek = dayIndex * 1440 + localTime.Hour * 60 + localTime.Minute;
            var isOpen = intervals.Any(interval =>
                minuteOfWeek >= interval.From && minuteOfWeek < interval.To);

            if (!isOpen)
            {
                return false;
            }
        }

        return true;
    }
}
