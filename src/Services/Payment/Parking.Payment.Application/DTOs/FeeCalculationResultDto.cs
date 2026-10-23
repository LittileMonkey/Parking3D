using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Payment.Application.DTOs
{

    /// <summary>
    /// DTO kết quả tính toán cước tổng thể trả về cho Client / Web / Mobile.
    /// </summary>
    public record FeeCalculationResultDto
    {
        public Guid ParkingLotId { get; init; }
        public DateTimeOffset EntryTime { get; init; }
        public DateTimeOffset ExitTime { get; init; }
        public double TotalMinutes { get; init; }
        public int TotalBillableBlocks { get; init; }
        public long TotalGrossAmountVnd { get; init; }
        public long TotalDailyCapDiscountVnd { get; init; }
        public long SubtotalAfterDailyCapVnd { get; init; }
        public bool IsGoldStarMember { get; init; }
        public long GoldStarDiscountAmountVnd { get; init; }
        public long FinalNetAmountVnd { get; init; }
        public string Currency { get; init; } = "VND";
        public IReadOnlyList<DayPricingBreakdownDto> DailyBreakdowns { get; init; } = [];
    }
}
