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
        private readonly NpgsqlDataSource _db;
        private readonly IMemoryCache _cache;
        // Biểu giá bãi đỗ rất ít khi đổi, lưu đệm trong RAM 30 phút để triệt tiêu vấn đề N+1 query
        private static readonly TimeSpan CacheDuration = TimeSpan.FromMinutes(30);
        public EstimatedPriceService(NpgsqlDataSource db, IMemoryCache cache)
        {
            _db = db;
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
            // [CẢI TIẾN 2 & 3]: Kiểm tra RAM Cache trước, nếu có thì KHÔNG cần truy vấn PostgreSQL
            if (!_cache.TryGetValue(cacheKey, out (BlockPrice Price, string Timezone) cachedConfig))
            {
                // [CẢI TIẾN 1]: SQL có kiểm tra thời gian hiệu lực (effective_from & effective_until)
                const string sql = """
                SELECT l.timezone, pr.parameters::text
                FROM parking_lots l
                JOIN pricing_plans pp ON pp.lot_id = l.id
                JOIN pricing_rules pr ON pr.plan_id = pp.id AND pr.rule_type = 'FLAT_BLOCK'
                WHERE l.id = @lotId 
                  AND pp.vehicle_type = @vehicleType 
                  AND pp.status = 'PUBLISHED'
                  AND pp.currency = 'VND'
                  AND pp.effective_from <= @startTime
                  AND (pp.effective_until IS NULL OR pp.effective_until >= @startTime)
                ORDER BY pp.version_no DESC 
                LIMIT 1;
                """;
                await using var cmd = _db.CreateCommand(sql);
                cmd.Parameters.AddWithValue("lotId", lotId);
                cmd.Parameters.AddWithValue("vehicleType", normalizedType);
                cmd.Parameters.AddWithValue("startTime", startTime.ToUniversalTime());
                await using var reader = await cmd.ExecuteReaderAsync();
                // Nếu bãi chưa công bố biểu giá hợp lệ vào thời điểm này
                if (!await reader.ReadAsync())
                {
                    return new EstimatedPriceResult
                    {
                        TotalFee = 0,
                        Currency = "VND",
                        Details = "Chưa có biểu giá hiệu lực cho loại xe này"
                    };
                }
                var timezoneName = reader.GetString(0);
                var parametersJson = reader.GetString(1);
                await reader.CloseAsync();
                // Chuyển đổi JSON tham số sang Record BlockPrice của Domain
                var blockPrice = JsonSerializer.Deserialize<BlockPrice>(
                    parametersJson,
                    new JsonSerializerOptions { PropertyNameCaseInsensitive = true })
                    ?? throw new InvalidOperationException("Cấu hình biểu giá không hợp lệ");
                cachedConfig = (blockPrice, timezoneName);
                // Lưu vào Memory Cache cho các lượt tìm kiếm tiếp theo
                _cache.Set(cacheKey, cachedConfig, CacheDuration);
            }
            // Xác định múi giờ địa phương của bãi xe (để cắt block nửa đêm 00:00 chuẩn xác)
            TimeZoneInfo tz;
            try
            {
                tz = TimeZoneInfo.FindSystemTimeZoneById(cachedConfig.Timezone);
            }
            catch
            {
                tz = TimeZoneInfo.FindSystemTimeZoneById("Asia/Ho_Chi_Minh");
            }
            // Tính toán chi phí thực tế bằng Domain logic lõi (BlockPrice.Estimate)
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
