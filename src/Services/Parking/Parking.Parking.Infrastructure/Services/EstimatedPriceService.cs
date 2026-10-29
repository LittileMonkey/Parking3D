using Microsoft.Extensions.Caching.Memory;
using Npgsql;
using Parking.Parking.Application.Interfaces;
using Parking.Parking.Domain;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

namespace Parking.Parking.Infrastructure.Services
{
    public class EstimatedPriceService : IEstimatedPriceService
    {
        private readonly IParkingLotRepository _parkingLotRepository;
        private readonly IMemoryCache _cache;
        // Biểu giá bãi đỗ rất ít khi đổi, lưu đệm trong RAM 30 phút để triệt tiêu vấn đề N+1 query
        private static readonly TimeSpan CacheDuration = TimeSpan.FromMinutes(30);
        public EstimatedPriceService(IParkingLotRepository parkingLotRepository, IMemoryCache cache)
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
            // 1. Kiểm tra RAM Cache trước, nếu có thì KHÔNG cần gọi xuống Repository
            if (!_cache.TryGetValue(cacheKey, out (BlockPrice Price, string Timezone) cachedConfig))
            {
                // 2. Gọi Repository để lấy cấu hình biểu giá từ DB
                var ruleConfig = await _parkingLotRepository.GetPricingRuleConfigAsync(lotId, normalizedType, startTime);
                if (ruleConfig == null)
                {
                    return new EstimatedPriceResult
                    {
                        TotalFee = 0,
                        Currency = "VND",
                        Details = "Chưa có biểu giá hiệu lực cho loại xe này"
                    };
                }
                // 3. Giải mã JSON cấu hình biểu giá sang Domain Record BlockPrice
                var blockPrice = JsonSerializer.Deserialize<BlockPrice>(
                    ruleConfig.Value.ParametersJson,
                    new JsonSerializerOptions { PropertyNameCaseInsensitive = true })
                    ?? throw new InvalidOperationException("Cấu hình biểu giá không hợp lệ");
                cachedConfig = (blockPrice, ruleConfig.Value.Timezone);
                // 4. Lưu vào Memory Cache cho các lượt tìm kiếm tiếp theo
                _cache.Set(cacheKey, cachedConfig, CacheDuration);
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
