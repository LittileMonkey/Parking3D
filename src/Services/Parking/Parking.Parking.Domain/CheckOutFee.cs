using System.Text.Json;

namespace Parking.Parking.Domain;

public static class CheckOutFee
{
    public static long Calculate(bool hasBooking, DateTimeOffset entryAt, DateTimeOffset expectedExitAt,
        DateTimeOffset pricedAt, string rulesJson, string timezone, DateTimeOffset? bookedStart = null)
    {
        var start = hasBooking ? expectedExitAt : entryAt;
        if (pricedAt <= start) return 0;
        var rules = JsonSerializer.Deserialize<BlockPrice>(rulesJson,
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true })
            ?? throw new ArgumentException("A valid pricing snapshot is required.");
        var zone=TimeZoneInfo.FindSystemTimeZoneById(timezone);
        var extra=rules.Estimate(start,pricedAt,zone);
        if(!hasBooking)return extra;
        // The reserved interval may already have consumed part/all of this calendar day's cap.
        var localDate=TimeZoneInfo.ConvertTime(expectedExitAt,zone).Date;
        var dayStart=DateTime.SpecifyKind(localDate,DateTimeKind.Unspecified);
        var nextDay=dayStart.AddDays(1);
        if(zone.IsInvalidTime(dayStart)||zone.IsAmbiguousTime(dayStart)||zone.IsInvalidTime(nextDay)||zone.IsAmbiguousTime(nextDay))
            throw new ArgumentException("Unsupported pricing midnight.");
        var midnight=new DateTimeOffset(TimeZoneInfo.ConvertTimeToUtc(dayStart,zone));
        var nextMidnight=new DateTimeOffset(TimeZoneInfo.ConvertTimeToUtc(nextDay,zone));
        var reservedStart=bookedStart??entryAt;
        var cappedStart=reservedStart>midnight?reservedStart:midnight;
        var reservedToday=expectedExitAt>cappedStart?rules.Estimate(cappedStart,expectedExitAt,zone):0;
        var firstStop=pricedAt<nextMidnight?pricedAt:nextMidnight;
        var extraToday=rules.Estimate(expectedExitAt,firstStop,zone);
        return extra-extraToday+Math.Min(extraToday,Math.Max(0,rules.DailyCapVnd-reservedToday));
    }
}
