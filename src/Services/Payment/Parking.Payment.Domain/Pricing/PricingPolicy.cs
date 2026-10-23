using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Payment.Domain.Pricing
{
    /// <summary>
    /// Value Object đại diện cho toàn bộ chính sách biểu giá của một bãi đỗ xe.
    /// </summary>
    public sealed record PricingPolicy(
        int InitialBlockMinutes,            // Thời lượng của block đầu tiên (VD: 60 phút)
        long InitialRateVnd,                // Giá cước cho block đầu tiên (VD: 20.000 đ)
        int SubsequentBlockMinutes,         // Thời lượng cho các block tiếp theo (VD: 15 phút)
        long SubsequentRateVnd,             //  Giá cước cho mỗi block tiếp theo (VD: 5.000 đ)
        decimal PeakMultiplier,             // Hệ số nhân giờ cao điểm (VD: 1.2m tương đương +20%)
        TimeOnly Peak1Start,                // Giờ bắt đầu cao điểm trưa (VD: 11:30)
        TimeOnly Peak1End,                  // Giờ kết thúc cao điểm trưa (VD: 13:00)
        TimeOnly Peak2Start,                // Giờ bắt đầu cao điểm chiều (VD: 17:30)
        TimeOnly Peak2End,                  // Giờ kết thúc cao điểm chiều (VD: 19:00)
        long DailyCapVnd,                   // Mức trần giá tối đa trong một ngày lịch (VD: 150.000 đ)
        decimal GoldStarDiscountRate        // Tỷ lệ chiết khấu hội viên Gold Star (VD: 0.10m = 10%)
    )
    {
    /// <summary>
    /// Kiểm tra tính toàn vẹn (Invariants) của chính sách giá để ngăn chặn dữ liệu cấu hình sai ngay từ đầu.
    /// </summary>
        public void Validate()
        {
            if (InitialBlockMinutes <= 0)
                throw new ArgumentException("Thời lượng các block đầu tiên phải lớn hơn 0 phút.", nameof(InitialBlockMinutes));


            if (SubsequentBlockMinutes <= 0)
                throw new ArgumentException("Thời lượng các block tiếp theo phải lớn hơn 0 phút.", nameof(SubsequentBlockMinutes));

            if (InitialRateVnd < 0 || SubsequentRateVnd < 0 || DailyCapVnd < 0)
                throw new ArgumentException("Đơn giá và mức trần ngày không được là số âm.");

            if (PeakMultiplier < 1.0m)
                throw new ArgumentException("Hệ số nhân giờ cao điểm phải >= 1.0 (không thể giảm giá vào giờ cao điểm).", nameof(PeakMultiplier));

            if (GoldStarDiscountRate is < 0.0m or > 1.0m)
                throw new ArgumentException("Tỷ lệ giảm giá Gold Star phải nằm trong khoảng từ 0.0 (0%) đến 1.0 (100%).", nameof(GoldStarDiscountRate));

            if (Peak1End <= Peak1Start)
                throw new ArgumentException("Giờ kết thúc cao điểm 1 phải sau giờ bắt đầu.", nameof(Peak1End));

            if (Peak2End <= Peak2Start)
                throw new ArgumentException("Giờ kết thúc cao điểm 2 phải sau giờ bắt đầu.", nameof(Peak2End));
        }




    }
}
