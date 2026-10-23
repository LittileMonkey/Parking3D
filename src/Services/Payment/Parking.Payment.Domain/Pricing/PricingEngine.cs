using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Payment.Domain.Pricing
{
    /// <summary>
    /// Domain Service chứa thuật toán tính cước tài chính cốt lõi:
    /// - Phân tách theo ranh giới nửa đêm địa phương (Midnight Boundary Split).
    /// - Chia Block: 60 phút đầu + chuỗi block 15 phút tiếp theo (làm tròn lên).
    /// - Nhận diện giờ cao điểm (Peak Hours: 11:30-13:00 và 17:30-19:00) nhân hệ số 1.2x.
    /// - Áp dụng trần ngày (Daily Cap) độc lập cho từng ngày lịch và chiết khấu hội viên Gold Star (10%).
    /// </summary>
    public static class PricingEngine
    {
        public static PricingResult Calculate(DateTimeOffset entryTime, DateTimeOffset exitTime, PricingPolicy policy, bool isGoldStarMember, TimeZoneInfo timeZone)
        {
            ArgumentNullException.ThrowIfNull(policy);
            ArgumentNullException.ThrowIfNull(timeZone);
            policy.Validate();

            if (exitTime <= entryTime)
                throw new ArgumentException("Thời gian ra (ExitTime) phải lớn hơn thời gian vào (EntryTime).", nameof(exitTime));
            var currentCursor = entryTime;
            var dayBreakdowns = new List<DayPricingBreakdown>();

            // 1. VÒNG LẶP PHÂN TÁCH THEO NGÀY LỊCH
            while (currentCursor < exitTime)
            {
                var localCurrent = TimeZoneInfo.ConvertTime(currentCursor, timeZone);

                var nextMidnightLocal = DateTime.SpecifyKind(localCurrent.Date.AddDays(1), DateTimeKind.Unspecified);

                // Phòng thủ thời gian không hợp lệ (nếu có chuyển đổi giờ mùa hè DST)
                if (timeZone.IsInvalidTime(nextMidnightLocal) || timeZone.IsAmbiguousTime(nextMidnightLocal))
                    throw new ArgumentException("Thời điểm nửa đêm không hợp lệ theo múi giờ được chỉ định.", nameof(timeZone));

                var nextMidnightUtc = new DateTimeOffset(TimeZoneInfo.ConvertTimeToUtc(nextMidnightLocal, timeZone));

                // Điểm kết thúc của ngày hiện tại (hoặc là giờ xe ra, hoặc là thời điểm nửa đêm)
                var dayEnd = exitTime < nextMidnightUtc ? exitTime : nextMidnightUtc;

                // 2. TÍNH TOÁN CÁC BLOCK TRONG NGÀY HIỆN TẠI
                int initialBlocks = 0;
                long initialAmountVnd = 0;
                int regularSubsequentBlocks = 0;
                long regularSubsequentAmountVnd = 0;
                int peakSubsequentBlocks = 0;
                long peakSubsequentAmountVnd = 0;

                var dayCursor = currentCursor;
                // Block khởi đầu (Initial Block 60p) chỉ áp dụng DUY NHẤT một lần ở thời điểm xe mới vào bãi
                if (dayCursor == entryTime)
                {
                    initialBlocks = 1;
                    initialAmountVnd = policy.InitialRateVnd;
                    var initialEnd = dayCursor.AddMinutes(policy.InitialBlockMinutes);
                    dayCursor = dayEnd < initialEnd ? dayEnd : initialEnd;
                }
                // 3. CÁC BLOCK 15 PHÚT TIẾP THEO (SUBSEQUENT BLOCKS - LÀM TRÒN LÊN)
                while (dayCursor < dayEnd)
                {
                    var blockStart = dayCursor;
                    var blockEnd = blockStart.AddMinutes(policy.SubsequentBlockMinutes);
                    // Kiểm tra xem block 15p này có rơi vào khung giờ cao điểm hay không
                    if (IsInPeakHour(blockStart, blockEnd, policy, timeZone))
                    {
                        peakSubsequentBlocks++;
                        var peakRate = (decimal)policy.SubsequentRateVnd * policy.PeakMultiplier;
                        peakSubsequentAmountVnd += checked((long)Math.Round(peakRate, MidpointRounding.AwayFromZero));
                    }
                    else
                    {
                        regularSubsequentBlocks++;
                        regularSubsequentAmountVnd += policy.SubsequentRateVnd;
                    }
                    dayCursor = blockEnd;
                }

                // 4. LƯU BÓC TÁCH CỦA NGÀY VÀO DANH SÁCH
                var breakdown = new DayPricingBreakdown(
                    Date: DateOnly.FromDateTime(localCurrent.Date),
                    StartTime: currentCursor,
                    EndTime: dayEnd,
                    InitialBlocks: initialBlocks,
                    InitialAmountVnd: initialAmountVnd,
                    RegularSubsequentBlocks: regularSubsequentBlocks,
                    RegularSubsequentAmountVnd: regularSubsequentAmountVnd,
                    PeakSubsequentBlocks: peakSubsequentBlocks,
                    PeakSubsequentAmountVnd: peakSubsequentAmountVnd,
                    DailyCapAppliedVnd: policy.DailyCapVnd
                );
                dayBreakdowns.Add(breakdown);
                currentCursor = dayEnd;


            }

            // 5. TỔNG HỢP VÀO ĐỐI TƯỢNG PRICINGRESULT
            return new PricingResult(
                EntryTime: entryTime,
                ExitTime: exitTime,
                IsGoldStarMember: isGoldStarMember,
                GoldStarDiscountRate: policy.GoldStarDiscountRate,
                DailyBreakdowns: dayBreakdowns
            );

        }

    

    /// <summary>
    /// Kiểm tra xem một block thời gian [blockStart, blockEnd) có giao nhau với bất kỳ khung giờ cao điểm nào không.
    /// Khung 1: 11:30 -> 13:00
    /// Khung 2: 17:30 -> 19:00
    /// </summary>
    private static bool IsInPeakHour(DateTimeOffset start, DateTimeOffset end, PricingPolicy policy, TimeZoneInfo timeZone)
        {
            var startLocal = TimeOnly.FromTimeSpan(TimeZoneInfo.ConvertTime(start, timeZone).TimeOfDay);
            var endLocal = TimeOnly.FromTimeSpan(TimeZoneInfo.ConvertTime(end, timeZone).TimeOfDay);
            // Trường hợp thông thường: block nằm trọn trong cùng 1 ngày
            if (endLocal > startLocal)
            {
                // Khung 1: Peak1Start -> Peak1End (11:30 - 13:00)
                if (startLocal < policy.Peak1End && endLocal > policy.Peak1Start)
                    return true;
                // Khung 2: Peak2Start -> Peak2End (17:30 - 19:00)
                if (startLocal < policy.Peak2End && endLocal > policy.Peak2Start)
                    return true;
            }
            else // Trường hợp biên cực hiếm: block 15p bắt đầu lúc 23:55 và kết thúc lúc 00:10 ngày hôm sau
            {
                if (startLocal < policy.Peak1End || endLocal > policy.Peak1Start)
                    return true;
                if (startLocal < policy.Peak2End || endLocal > policy.Peak2Start)
                    return true;
            }
            return false;
        }

    }
}
