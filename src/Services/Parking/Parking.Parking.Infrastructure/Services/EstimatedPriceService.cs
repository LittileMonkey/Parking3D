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
        private readonly ICurrentPricingCustomer? _currentCustomer;
        private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

        public EstimatedPriceService(IParkingLotRepository parkingLotRepository, ICurrentPricingCustomer? currentCustomer = null)
        {
            _parkingLotRepository = parkingLotRepository;
            _currentCustomer = currentCustomer;
        }
        public async Task<EstimatedPriceResult> CalculateEstimatedFeeAsync(
            Guid lotId,
            string vehicleType,
            DateTime startTime,
            int expectedDurationMinutes,
            CancellationToken cancellationToken = default)
        {
            var normalizedType = vehicleType.Trim().ToUpperInvariant();
            // Select against the requested instant on every estimate. A lot/type cache
            // cannot represent scheduled plans or a newly published overlapping version.
            var ruleConfig = await _parkingLotRepository.GetPricingRuleConfigAsync(lotId, normalizedType, startTime, cancellationToken);
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
            var grace = _currentCustomer?.UserId is Guid customerId
                ? await _parkingLotRepository.GetAvailableGraceMinutesAsync(lotId, normalizedType, startOffset, customerId, cancellationToken)
                : 0;
            var totalAmount = price.Estimate(startOffset.AddMinutes(grace), endOffset, tz);
            return new EstimatedPriceResult
            {
                TotalFee = totalAmount,
                Currency = "VND",
                MinimumChargeVnd = price.MinimumChargeVnd,
                Details = $"Block {price.BlockMinutes}p, Đơn giá {price.RateVnd:N0} đ, Trần ngày {price.DailyCapVnd:N0} đ"
                    + (grace > 0 ? $". Đã tính miễn {grace} phút đầu theo quyền lợi trong ngày; quyền lợi được kiểm tra lại khi đặt chỗ." : string.Empty)
                    + (price.MinimumChargeVnd > 0 ? $". Phí cuối cùng tối thiểu {price.MinimumChargeVnd:N0} đ/lượt sau ưu đãi." : string.Empty)
            };
        }
    }
}
