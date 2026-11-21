using Grpc.Core;
using MediatR;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Caching.Memory;  
using Parking.Contracts.Catalog.V1;        
using Parking.Payment.Application.DTOs;
using Parking.Pricing;
using Parking.ServiceDefaults;              
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;


namespace Parking.Payment.Application.UseCase.CalculateFee
{
    /// <summary>
    /// Handler xử lý CalculateFeeQuery theo mô hình CQRS:
    /// 1. Gọi gRPC sang Parking để lấy biểu giá thật theo thời điểm, không cache theo bãi/loại xe.
    /// 2. Bắt lỗi 404 nếu bãi xe chưa có biểu giá hiệu lực (Tuyệt đối không tính 0 đồng).
    /// 3. Kích hoạt Động cơ tính cước PricingEngine.Calculate ở tầng Domain.
    /// </summary>
    public class CalculateFeeQueryHandler : IRequestHandler<CalculateFeeQuery, FeeCalculationResultDto>
    {
        private static readonly TimeZoneInfo VnTz = TimeZoneInfo.TryFindSystemTimeZoneById("Asia/Ho_Chi_Minh", out var tz) 
            ? tz 
            : (TimeZoneInfo.TryFindSystemTimeZoneById("SE Asia Standard Time", out var winTz) ? winTz : TimeZoneInfo.Utc);

        private readonly ParkingCatalog.ParkingCatalogClient _parkingCatalogClient;
        

        private readonly IConfiguration? _config;

        public CalculateFeeQueryHandler(ParkingCatalog.ParkingCatalogClient parkingCatalogClient, IMemoryCache cache, IConfiguration? config = null)
        {
            _parkingCatalogClient = parkingCatalogClient;
            _ = cache; // Retain constructor compatibility; effective pricing must be read fresh.
            _config = config;
        }

        public async Task<FeeCalculationResultDto> Handle(CalculateFeeQuery request, CancellationToken cancellationToken)
        {
            var normalizedType = request.VehicleType.Trim().ToUpperInvariant();
            // A lot/type cache hides newly published prices and scheduled plans.
            (PricingPolicy Policy, TimeZoneInfo Tz) cachedData;
            {
                // 2. Chuyển đổi EntryTime sang Unix timestamp để kiểm tra thời gian hiệu lực
                var gRpcRequest = new PricingPolicyRequest
                {
                    LotId = request.ParkingLotId.ToString(),
                    VehicleType = normalizedType,
                    TimestampUnixSeconds = request.EntryTime.ToUnixTimeSeconds()
                };
                // 3. Gọi sang Parking Service qua gRPC lấy dữ liệu thật
                PricingPolicyReply reply;
                try
                {
                    var headers = _config != null ? GrpcHeaders.For(_config) : new Metadata();
                    reply = await _parkingCatalogClient.GetPricingPolicyAsync(
                        gRpcRequest,
                        headers: headers,
                        deadline: DateTime.UtcNow.AddSeconds(5),
                        cancellationToken: cancellationToken);
                }
                catch (RpcException ex) when (ex.StatusCode == StatusCode.NotFound)
                {
                    throw new ServiceException(404, $"Chưa có biểu giá hiệu lực cho loại xe '{request.VehicleType}' tại bãi đỗ này.");
                }
                catch (RpcException ex) when (ex.StatusCode == StatusCode.Unavailable || ex.StatusCode == StatusCode.DeadlineExceeded)
                {
                    throw new ServiceException(503, "Dịch vụ Parking Catalog hiện không khả dụng. Vui lòng thử lại sau.");
                }
                catch (RpcException ex) when (ex.StatusCode == StatusCode.Unauthenticated)
                {
                    throw new ServiceException(500, "Xác thực dịch vụ nội bộ thất bại (Grpc:ServiceKey không khớp hoặc thiếu).");
                }
                // 4. KIỂM SOÁT BẮT BUỘC: Nếu không tìm thấy biểu giá -> Ném lỗi 404, không bao giờ tính 0 đồng!
                if (!reply.Found)
                {
                    throw new ServiceException(404, $"Chưa có biểu giá hiệu lực cho loại xe '{request.VehicleType}' tại bãi đỗ này.");
                }
                // 5. Khởi tạo PricingPolicy từ dữ liệu thật
                var peak1Start = TimeOnly.TryParse(reply.Peak1Start, out var p1s) ? p1s : new TimeOnly(11, 30);
                var peak1End = TimeOnly.TryParse(reply.Peak1End, out var p1e) ? p1e : new TimeOnly(13, 0);
                var peak2Start = TimeOnly.TryParse(reply.Peak2Start, out var p2s) ? p2s : new TimeOnly(17, 30);
                var peak2End = TimeOnly.TryParse(reply.Peak2End, out var p2e) ? p2e : new TimeOnly(19, 0);
                TimeZoneInfo lotTz;
                try
                {
                    lotTz = TimeZoneInfo.FindSystemTimeZoneById(reply.Timezone);
                }
                catch
                {
                    lotTz = VnTz;
                }
                var policy = new PricingPolicy(
                    InitialBlockMinutes: reply.InitialBlockMinutes,
                    InitialRateVnd: reply.InitialRateVnd,
                    SubsequentBlockMinutes: reply.SubsequentBlockMinutes,
                    SubsequentRateVnd: reply.SubsequentRateVnd,
                    PeakMultiplier: (decimal)reply.PeakMultiplier,
                    Peak1Start: peak1Start,
                    Peak1End: peak1End,
                    Peak2Start: peak2Start,
                    Peak2End: peak2End,
                    DailyCapVnd: reply.DailyCapVnd,
                    GoldStarDiscountRate: (decimal)reply.GoldStarDiscountRate,
                    MinimumChargeVnd: reply.MinimumChargeVnd
                );
                cachedData = (policy, lotTz);
            }
            // 6. Kích hoạt Động cơ tính cước lõi tại tầng Domain với biểu giá thật
            var pricingResult = PricingEngine.Calculate(
                entryTime: request.EntryTime,
                exitTime: request.ExitTime,
                policy: cachedData.Policy,
                isGoldStarMember: request.isGoldStarMember,
                timeZone: cachedData.Tz
            );
            // 7. Ánh xạ (Mapping) kết quả sang FeeCalculationResultDto
            return new FeeCalculationResultDto
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
                MinimumChargeVnd = pricingResult.MinimumChargeVnd,
                MinimumChargeAdjustmentVnd = pricingResult.MinimumChargeAdjustmentVnd,
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
        }
    }
}
