using Parking.Parking.Application.Interfaces;
using Parking.Parking.Domain;
using System;
using System.Text.Json;
using System.Threading.Tasks;

namespace Parking.Parking.Infrastructure.Services
{
    public class EstimatedPriceService : IEstimatedPriceService
    {
        private readonly IParkingLotRepository _parkingLotRepository;
        private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

        public EstimatedPriceService(IParkingLotRepository parkingLotRepository)
        {
            _parkingLotRepository = parkingLotRepository;
        }
        public async Task<EstimatedPriceResult> CalculateEstimatedFeeAsync(
            Guid lotId,
            string vehicleType,
            DateTime startTime,
            int expectedDurationMinutes)
        {
            var normalizedType = vehicleType.Trim().ToUpperInvariant();
            // Select against the requested instant on every estimate. A lot/type cache
            // cannot represent scheduled plans or a newly published overlapping version.
            var ruleConfig = await _parkingLotRepository.GetPricingRuleConfigAsync(lotId, normalizedType, startTime);
            if (ruleConfig == null)
            {
                return new EstimatedPriceResult
                {
                    TotalFee = 0,
                    Currency = "VND",
                    Details = "Chưa có biểu giá hiệu lực cho loại xe này",
                    HasPricing = false
                };
            }
            var price = JsonSerializer.Deserialize<BlockPrice>(ruleConfig.Value.ParametersJson, JsonOptions)
                ?? throw new InvalidOperationException("Cấu hình biểu giá không hợp lệ");
            // 5. Xác định múi giờ địa phương của bãi xe
            TimeZoneInfo tz;
            try
            {
                tz = TimeZoneInfo.FindSystemTimeZoneById(ruleConfig.Value.Timezone);
            }
            catch
            {
                tz = TimeZoneInfo.FindSystemTimeZoneById("Asia/Ho_Chi_Minh");
            }
            // 6. Tính toán chi phí thực tế bằng Domain logic lõi (BlockPrice.Estimate)
            var startOffset = new DateTimeOffset(startTime.ToUniversalTime(), TimeSpan.Zero);
            var endOffset = startOffset.AddMinutes(expectedDurationMinutes);
            var totalAmount = price.Estimate(startOffset, endOffset, tz);
            return new EstimatedPriceResult
            {
                TotalFee = totalAmount,
                Currency = "VND",
                Details = $"Block {price.BlockMinutes}p, Đơn giá {price.RateVnd:N0} đ, Trần ngày {price.DailyCapVnd:N0} đ"
            };
        }
    }
}
