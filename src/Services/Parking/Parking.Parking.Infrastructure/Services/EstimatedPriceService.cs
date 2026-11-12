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
        private readonly IParkingCacheService _cache;
        private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };
        // Biểu giá bãi đỗ rất ít khi đổi, lưu đệm 30 phút để triệt tiêu vấn đề N+1 query
        private static readonly TimeSpan CacheDuration = TimeSpan.FromMinutes(30);

        private sealed record CachedPricingRule(BlockPrice Price, string Timezone);

        public EstimatedPriceService(IParkingLotRepository parkingLotRepository, IParkingCacheService cache)
        {
            _parkingLotRepository = parkingLotRepository;
            _cache = cache;
        }
        public async Task<EstimatedPriceResult> CalculateEstimatedFeeAsync(
            Guid lotId,
            string vehicleType,
            DateTime startTime,
            int expectedDurationMinutes)
        {
            var normalizedType = vehicleType.Trim().ToUpperInvariant();
            var cacheKey = $"pricing_rule:{lotId}:{normalizedType}";

            // 1. Đọc từ Distributed Cache (Redis) trước, chỉ query Repository khi cache miss
            var cachedConfig = await _cache.GetOrSetAsync<CachedPricingRule>(
                cacheKey,
                async () =>
                {
                    var ruleConfig = await _parkingLotRepository.GetPricingRuleConfigAsync(lotId, normalizedType, startTime);
                    if (ruleConfig == null)
                        return null;

                    var blockPrice = JsonSerializer.Deserialize<BlockPrice>(
                        ruleConfig.Value.ParametersJson,
                        JsonOptions)
                        ?? throw new InvalidOperationException("Cấu hình biểu giá không hợp lệ");

                    return new CachedPricingRule(blockPrice, ruleConfig.Value.Timezone);
                },
                CacheDuration);

            if (cachedConfig == null)
            {
                return new EstimatedPriceResult
                {
                    TotalFee = 0,
                    Currency = "VND",
                    Details = "Chưa có biểu giá hiệu lực cho loại xe này"
                };
            }
            // 5. Xác định múi giờ địa phương của bãi xe
            TimeZoneInfo tz;
            try
            {
                tz = TimeZoneInfo.FindSystemTimeZoneById(cachedConfig.Timezone);
            }
            catch
            {
                tz = TimeZoneInfo.FindSystemTimeZoneById("Asia/Ho_Chi_Minh");
            }
            // 6. Tính toán chi phí thực tế bằng Domain logic lõi (BlockPrice.Estimate)
            var startOffset = new DateTimeOffset(startTime.ToUniversalTime(), TimeSpan.Zero);
            var endOffset = startOffset.AddMinutes(expectedDurationMinutes);
            var totalAmount = cachedConfig.Price.Estimate(startOffset, endOffset, tz);
            return new EstimatedPriceResult
            {
                TotalFee = totalAmount,
                Currency = "VND",
                Details = $"Block {cachedConfig.Price.BlockMinutes}p, Đơn giá {cachedConfig.Price.RateVnd:N0} đ, Trần ngày {cachedConfig.Price.DailyCapVnd:N0} đ"
            };
        }
    }
}
