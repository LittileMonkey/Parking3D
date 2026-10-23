using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Payment.Application.DTOs
{
    /// <summary>
    /// DTO gửi ra ngoài (Frontend) thể hiện chi tiết bóc tách cước theo từng ngày lịch của khách.
    /// </summary>
    public record DayPricingBreakdownDto
    {
        public DateOnly Date { get; init; }
        public DateTimeOffset StartTime { get; init; }
        public DateTimeOffset EndTime { get; init; }
        public int TotalBlocks { get; init; }
        public int PeakBlocks { get; init; }
        public long GrossAmountVnd { get; init; }
        public long DailyCapDiscountVnd { get; init; }
        public long NetAmountVnd { get; init; }

    }
}
