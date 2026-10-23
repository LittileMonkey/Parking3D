using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Payment.Domain.Pricing
{
    /// <summary>
    /// Value Object đại diện cho kết quả tính cước tổng thể của một phiên gửi xe
    /// Đóng gói tổng tiền cước thô, các khoản giảm trừ (Daily Cap, Gold Star) và số tiền thực thu cuối cùng
    /// </summary>
    public sealed record PricingResult(
        DateTimeOffset EntryTime,                               // Thời điểm xe vào bãi
        DateTimeOffset ExitTime,                                // Thời điểm xe ra bãi
        bool IsGoldStarMember,                                  // Khách hàng có phải là hội viên Gold Star hay không
        decimal GoldStarDiscountRate,                           // Tỷ lệ giảm giá cho hội viên Gold Star (VD: 0.10m = 10%)
        IReadOnlyList<DayPricingBreakdown> DailyBreakdowns      // Danh sách chi tiết bóc tách cước theo từng ngày lịch
    )
    {
        /// Tổng khoảng thời gian thực tế xe đỗ trong bãi
        public TimeSpan ActualDuration => ExitTime - EntryTime;

        /// Tổng số phút gửi xe thực tế
        public double TotalActualMinutes => ActualDuration.TotalMinutes;

        /// Tổng số block đã làm tròn tính cước trên toàn bộ các ngày
        public int TotalBillableBlocks => DailyBreakdowns.Sum(d => d.TotalBlocks);

        /// Tổng tiền cước thô trước mọi khoản giảm trừ
        public long TotalGrossAmountVnd => DailyBreakdowns.Sum(d => d.GrossAmountVnd);

        /// Tổng số tiền được miễn giảm từ chính sách trần giá ngày (Daily Cap) của tất cả các ngày
        public long TotalDailyCapDiscountVnd => DailyBreakdowns.Sum(d => d.DailyCapDiscountVnd);


        /// Tổng tiền cước sau khi đã trừ trần Daily Cap (nhưng chưa trừ giảm giá Gold Star)
        public long SubtotalAfterDailyCapVnd => DailyBreakdowns.Sum(d => d.NetAmountVnd);


        /// Số tiền được giảm giá dành riêng cho hội viên Gold Star (10% trên số tiền sau Daily Cap)
        public long GoldStarDiscountAmountVnd
        {
            get
            {
                if (!IsGoldStarMember || GoldStarDiscountRate <= 0)
                    return 0;
                // Làm tròn số tiền chiết khấu theo chuẩn thương mại Việt Nam (AwayFromZero)
                var rawDiscount = (decimal)SubtotalAfterDailyCapVnd * GoldStarDiscountRate;
                return checked((long)Math.Round(rawDiscount, MidpointRounding.AwayFromZero));
            }
        }

        /// Số tiền thực thu cuối cùng mà khách hàng phải thanh toán.
        public long FinalNetAmountVnd => SubtotalAfterDailyCapVnd - GoldStarDiscountAmountVnd;

    }
}
