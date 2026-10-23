using MediatR;
using Parking.Payment.Application.DTOs;
using Parking.Payment.Domain.Pricing;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Payment.Application.UseCase.CalculateFee
{
    /// <summary>
    /// Handler xử lý CalculateFeeQuery theo mô hình CQRS:
    /// Tải chính sách biểu giá (PricingPolicy) của bãi xe.Kích hoạt Động cơ tính cước PricingEngine.Calculate ở tầng Domain. Ánh xạ (Mapping) từ PricingResult sang FeeCalculationResultDto.
    /// </summary>
    public class CalculateFeeQueryHandler : IRequestHandler<CalculateFeeQuery, FeeCalculationResultDto>
    {
        // Múi giờ Việt Nam (+07:00), hỗ trợ tương thích đa nền tảng cả Windows lẫn Linux Docker
        private static readonly TimeZoneInfo VnTz = TimeZoneInfo.TryFindSystemTimeZoneById("Asia/Ho_Chi_Minh", out var tz) ? tz : (TimeZoneInfo.TryFindSystemTimeZoneById("SE Asia Standard Time", out var winTz) ? winTz : TimeZoneInfo.Utc);

        public Task<FeeCalculationResultDto> Handle(CalculateFeeQuery request, CancellationToken cancellationToken)
        {
            // Nạp biểu giá quy chuẩn của bãi đỗ xe
            var policy = GetDefaultPolicy();
            // Kích hoạt Động cơ tính cước lõi tại tầng Domain
            var pricingResult = PricingEngine.Calculate(
                entryTime: request.EntryTime,
                exitTime: request.ExitTime,
                policy: policy,
                isGoldStarMember: request.isGoldStarMember,
                timeZone: VnTz
                );

            // Ánh xạ (Mapping) kết quả sang FeeCalculationResultDto
            var resultDto = new FeeCalculationResultDto
            {
                ParkingLotId = request.ParkingLotId,
                EntryTime = pricingResult.EntryTime,
                ExitTime = pricingResult.ExitTime,
                TotalMinutes = pricingResult.TotalActualMinutes,
                TotalBillableBlocks = pricingResult.TotalBillableBlocks,
                TotalGrossAmountVnd = pricingResult.TotalGrossAmountVnd,
                TotalDailyCapDiscountVnd = pricingResult.TotalDailyCapDiscountVnd,
                SubtotalAfterDailyCapVnd = pricingResult.SubtotalAfterDailyCapVnd,
                IsGoldStarMember = pricingResult.IsGoldStarMember,
                GoldStarDiscountAmountVnd = pricingResult.GoldStarDiscountAmountVnd,
                FinalNetAmountVnd = pricingResult.FinalNetAmountVnd,
                Currency = "VND",
                DailyBreakdowns = pricingResult.DailyBreakdowns.Select(d => new DayPricingBreakdownDto
                {
                    Date = d.Date,
                    StartTime = d.StartTime,
                    EndTime = d.EndTime,
                    TotalBlocks = d.TotalBlocks,
                    PeakBlocks = d.PeakSubsequentBlocks,
                    GrossAmountVnd = d.GrossAmountVnd,
                    DailyCapDiscountVnd = d.DailyCapDiscountVnd,
                    NetAmountVnd = d.NetAmountVnd
                }).ToList()
            };

            return Task.FromResult(resultDto);
        }

        private static PricingPolicy GetDefaultPolicy() => new(
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
    }
}
