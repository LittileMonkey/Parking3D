using Parking.Payment.Domain.Pricing;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Xunit;

namespace Parking.Microservices.Tests
{
    /// <summary>
    /// Bộ Unit Test bao phủ 100% các kịch bản của Động cơ tính cước PricingEngine:
    ///     Block 60p đầu tiên
    ///     Làm tròn lên block 15p
    ///     Hệ số cao điểm 1.2x (11:30-13:00 và 17:30-19:00)
    ///     Chặn trần Daily Cap độc lập theo ngày
    ///     Cắt nửa đêm (Midnight Boundary Split)
    ///     Chiết khấu 10% hội viên Gold Star
    ///     Kiểm thử ngoại lệ tham số sai
    /// </summary>
    public class PricingEngineTests
    {
        private static readonly TimeZoneInfo VnTz = TimeZoneInfo.FindSystemTimeZoneById("Asia/Ho_Chi_Minh");

        private static PricingPolicy CreateStandardPolicy()
            => new(
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
                GoldStarDiscountRate: 0.10m
            );



        //Tính toán mức phí ban đầu cần áp dụng khi thời lượng nằm trong 60 phút đầu tiên
        [Fact]
        public void Calculate_ShouldChargeInitialRate_WhenDurationWithinFirst60Minutes()
        {
            // Khách vào lúc 08:00, ra lúc 08:45 (đỗ 45 phút <= 60 phút đầu)
            var policy = CreateStandardPolicy();
            var entry = new DateTimeOffset(2026, 10, 23, 8, 0, 0, TimeSpan.FromHours(7));
            var exit = entry.AddMinutes(45);

            //ACT
            var result = PricingEngine.Calculate(entry, exit, policy, isGoldStarMember: false, VnTz);

            // Chỉ tính đúng 1 block đầu 20.000 đ, không phát sinh block tiếp theo
            Assert.Equal(20_000, result.FinalNetAmountVnd);
            Assert.Equal(1, result.TotalBillableBlocks);
            Assert.Single(result.DailyBreakdowns);
        }
        //Tính toán khi thời lượng vượt quá khoảng thời gian ban đầu
        //Cần được làm tròn lên móc 15' tiếp theo
        [Fact]
        public void Calculate_ShouldRoundUpToNext15MinBlock_WhenDurationExceedsInitialBlock()
        {
            //Khách đỗ 68 phút (vào 08:00, ra 09:08)
            // Tiền: 20.000 (block đầu) + 5.000 (1 block 15p) = 25.000 đ
            var policy = CreateStandardPolicy();
            var entry = new DateTimeOffset(2026, 10, 23, 8, 0, 0, TimeSpan.FromHours(7));
            var exit = entry.AddMinutes(68);

            //ACT
            var result = PricingEngine.Calculate(entry, exit, policy, isGoldStarMember: false, VnTz);

            Assert.Equal(25_000, result.FinalNetAmountVnd);
            Assert.Equal(2, result.TotalBillableBlocks); 


        }

        //Tính toán cần áp dụng hệ số nhân giờ cao điểm khi các khối thời gian rơi vào khung giờ cao điểm
        [Fact]
        public void Calculate_ShouldApplyPeakMultiplier_WhenBlocksFallIntoPeakHours()
        {
            //Khách vào 10:30, ra 12:30 (tổng 2 tiếng = 120 phút)
            // - 10:30 -> 11:30: 60 phút đầu (giá cố định 20.000 đ)
            // - 11:30 -> 12:30: 60 phút tiếp theo = 4 block 15p, TOÀN BỘ rơi vào cao điểm trưa (11:30 - 13:00)
            // Mỗi block cao điểm: 5.000 x 1.2 = 6.000 đ. 4 block = 24.000 đ.
            // Tổng tiền dự kiến: 20.000 + 24.000 = 44.000 đ.
            var policy = CreateStandardPolicy();
            var entry = new DateTimeOffset(2026, 10, 23, 10, 30, 0, TimeSpan.FromHours(7));
            var exit = entry.AddMinutes(120);

            var result = PricingEngine.Calculate(entry, exit, policy, isGoldStarMember: false, VnTz);

            Assert.Equal(44_000, result.FinalNetAmountVnd);
            Assert.Equal(4, result.DailyBreakdowns[0].PeakSubsequentBlocks);
            Assert.Equal(0, result.DailyBreakdowns[0].RegularSubsequentBlocks);

        }


        // Tinh toán giá trần của 1 ngày 
        [Fact]
        public void Calculate_ShouldCapAtDailyLimit_WhenTotalCostExceedsDailyCap()
        {
            // Khách đỗ liên tục 18 tiếng từ 05:00 sáng đến 23:00 đêm cùng ngày
            var policy = CreateStandardPolicy();
            var entry = new DateTimeOffset(2026, 10, 23, 5, 0, 0, TimeSpan.FromHours(7));
            var exit = entry.AddHours(18);

            var result = PricingEngine.Calculate(entry, exit, policy, isGoldStarMember: false, VnTz);

            Assert.Equal(150_000, result.FinalNetAmountVnd);
            Assert.True(result.TotalDailyCapDiscountVnd > 0, "Phải có số tiền giảm trừ do chạm trần Daily Cap");
            Assert.True(result.TotalGrossAmountVnd > 150_000, "Cước thô phải lớn hơn mức trần");



        }

        // tính toán chia thành 2 ngày khi khách đỗ qua đêm
        [Fact]
        public void Calculate_ShouldSplitAtMidnight_WhenParkingAcrossMultipleDays()
        {
            // Khách đỗ qua đêm từ 22:00 hôm trước(23 / 10) đến 08:00 hôm sau(24 / 10)
            var policy = CreateStandardPolicy();
            var entry = new DateTimeOffset(2026, 10, 23, 22, 0, 0, TimeSpan.FromHours(7));
            var exit = new DateTimeOffset(2026, 10, 24, 8, 0, 0, TimeSpan.FromHours(7));

            var result = PricingEngine.Calculate(entry, exit, policy, isGoldStarMember: false, VnTz);

            Assert.Equal(2, result.DailyBreakdowns.Count);
            Assert.Equal(new DateOnly(2026, 10, 23), result.DailyBreakdowns[0].Date);
            Assert.Equal(new DateOnly(2026, 10, 24), result.DailyBreakdowns[1].Date);

            // Ngày 2 không được tính block khởi đầu 60p nữa (InitialBlocks = 0)
            Assert.Equal(0, result.DailyBreakdowns[1].InitialBlocks);

        }

        //Tính tiền khách thành viên
        [Fact]
        public void Calculate_ShouldApplyGoldStarDiscount_WhenCustomerIsGoldStarMember()
        {
            // Khách đỗ 68 phút (cước thông thường là 25.000 đ)
            var policy = CreateStandardPolicy();
            var entry = new DateTimeOffset(2026, 10, 23, 8, 0, 0, TimeSpan.FromHours(7));
            var exit = entry.AddMinutes(68);
            
            var result = PricingEngine.Calculate(entry, exit, policy, isGoldStarMember: true, VnTz);
            
            Assert.Equal(25_000, result.SubtotalAfterDailyCapVnd);
            Assert.Equal(2_500, result.GoldStarDiscountAmountVnd);
            Assert.Equal(22_500, result.FinalNetAmountVnd);
        }


        // bắt lỗi dự liệu thời gian ra trước khi vào
        [Fact]
        public void Calculate_ShouldThrowArgumentException_WhenExitTimeBeforeOrEqualToEntryTime()
        {
            // Giờ ra nhỏ hơn hoặc bằng giờ vào (dữ liệu vô lý)
            var policy = CreateStandardPolicy();
            var entry = new DateTimeOffset(2026, 10, 23, 8, 0, 0, TimeSpan.FromHours(7));
            var exit = entry.AddMinutes(-10); 



            Assert.Throws<ArgumentException>(() =>
                PricingEngine.Calculate(entry, exit, policy, isGoldStarMember: false, VnTz)
            );
        }

    }
}
