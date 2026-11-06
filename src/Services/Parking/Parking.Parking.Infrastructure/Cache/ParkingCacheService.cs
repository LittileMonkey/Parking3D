using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Parking.Parking.Application.Interfaces;

namespace Parking.Parking.Infrastructure.Cache;

/// <summary>
/// Triển khai Caching dùng IMemoryCache với cơ chế TTL (Time-To-Live).
/// Đáp ứng tiêu chuẩn SCRUM-80: phản hồi < 20ms cho cấu trúc tĩnh bãi xe.
/// </summary>
public sealed class ParkingCacheService(
    IMemoryCache memoryCache,
    ILogger<ParkingCacheService> logger) : IParkingCacheService
{
    public async Task<T?> GetOrSetAsync<T>(
        string key,
        Func<Task<T?>> factory,
        TimeSpan? expiration = null,
        CancellationToken ct = default)
    {
        // 1. Kiểm tra trong Cache có dữ liệu chưa (Cache HIT)
        if (memoryCache.TryGetValue(key, out T? cachedValue))
        {
            logger.LogDebug("[CACHE HIT] Key: {Key}", key);
            return cachedValue;
        }

        // 2. Nếu chưa có (Cache MISS), chạy hàm factory lấy dữ liệu từ DB
        logger.LogDebug("[CACHE MISS] Key: {Key}. Đang truy vấn từ Database...", key);
        var value = await factory();

        if (value is not null)
        {
            // Mặc định lưu 12 giờ theo yêu cầu SCRUM-80
            var ttl = expiration ?? TimeSpan.FromHours(12);
            var cacheOptions = new MemoryCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = ttl
            };

            memoryCache.Set(key, value, cacheOptions);
            logger.LogInformation("[CACHE SET] Key: {Key} đã lưu với TTL: {TTL}", key, ttl);
        }

        return value;
    }

    public Task RemoveAsync(string key, CancellationToken ct = default)
    {
        memoryCache.Remove(key);
        logger.LogInformation("[CACHE EVICT] Đã xóa key: {Key}", key);
        return Task.CompletedTask;
    }
}

