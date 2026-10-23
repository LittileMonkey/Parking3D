using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Payment.Domain.Pricing
{

    /// <summary>
    /// Value Object chứa chi tiết tính cước bóc tách của một ngày lịch cụ thể (sau khi chia theo ranh giới nửa đêm)
    /// Đảm bảo tính minh bạch tuyệt đối khi in hóa đơn và lưu vết kiểm toán tài chính (Audit)
    /// </summary>
    public sealed record DayPricingBreakdown(
        DateOnly Date,                  // Ngày lịch địa phương (VD: 2026-10-22)
        DateTimeOffset StartTime,       // Thời điểm bắt đầu tính trong ngày (giờ xe vào hoặc 00:00:00)
        DateTimeOffset EndTime,         // Thời điểm kết thúc trong ngày (giờ xe ra hoặc nửa đêm 24:00:00)
        int InitialBlocks,              // Số block đầu tiên 60 phút (chỉ có ở ngày đầu tiên xe vào)
        long InitialAmountVnd,          // Tiền cước block đầu tiên (VD: 20.000 đ)
        int RegularSubsequentBlocks,    // Số block 15p thường ngoài giờ cao điểm
        long RegularSubsequentAmountVnd,// Tiền cước các block thường (VD: 4 block x 5.000 = 20.000 đ)
        int PeakSubsequentBlocks,       // Số block 15p rơi vào giờ cao điểm
        long PeakSubsequentAmountVnd,   // Tiền cước các block cao điểm (VD: 2 block x 5.000 x 1.2 = 12.000 đ)
        long DailyCapAppliedVnd         // Mức trần ngày áp dụng cho ngày này (VD: 150.000 đ)
    )
    {
        /// Tổng số block tính tiền trong ngày
        public int TotalBlocks => InitialBlocks + RegularSubsequentBlocks + PeakSubsequentBlocks;

        /// Tổng tiền cước thô trong ngày trước khi áp trần Daily Cap
        /// Công thức: Tiền block đầu + Tiền block thường + Tiền block cao điểm
        public long GrossAmountVnd => InitialAmountVnd + RegularSubsequentAmountVnd + PeakSubsequentAmountVnd;

        /// Số tiền được giảm trừ nhờ chính sách trần giá ngày (Daily Cap)
        /// Nếu tổng tiền cước thô vượt quá Daily Cap thì phần dôi dư chính là số tiền được miễn giảm cho khách
        public long DailyCapDiscountVnd => GrossAmountVnd > DailyCapAppliedVnd ? GrossAmountVnd - DailyCapAppliedVnd : 0;

        /// Số tiền thực thu cuối cùng của ngày này (sau khi đã chặn trần Daily Cap)
        public long NetAmountVnd => GrossAmountVnd - DailyCapDiscountVnd;

    }
}
