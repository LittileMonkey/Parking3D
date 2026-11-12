using System.Text.Json;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Logging;
using Parking.Parking.Application.Interfaces;

namespace Parking.Parking.Infrastructure.Cache;

/// <summary>
/// Triển khai Distributed Caching dùng <see cref="IDistributedCache"/> (Redis ở môi trường triển khai
/// hoặc MemoryDistributedCache khi fallback local) với TTL mặc định 12 giờ cho SCRUM-80.
/// Kèm cơ chế khóa theo key chống cache stampede (tự giải phóng khỏi RAM) và fallback về DB nếu Redis lỗi tạm thời.
/// </summary>
public sealed class ParkingCacheService(
    IDistributedCache distributedCache,
    ILogger<ParkingCacheService> logger) : IParkingCacheService
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    private readonly Dictionary<string, LockEntry> _locks = new(StringComparer.Ordinal);

    private sealed class LockEntry
    {
        public readonly SemaphoreSlim Semaphore = new(1, 1);
        public int RefCount;
    }

    public async Task<T?> GetOrSetAsync<T>(
        string key,
        Func<Task<T?>> factory,
        TimeSpan? expiration = null,
        CancellationToken ct = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(key);
        ArgumentNullException.ThrowIfNull(factory);

        // 1. Kiểm tra nhanh trong Distributed Cache (Cache HIT -> trả về ngay, không cần chờ khóa)
        var cached = await TryGetAsync<T>(key, ct);
        if (cached.Found)
        {
            logger.LogDebug("[CACHE HIT] Key: {Key}", key);
            return cached.Value;
        }

        // 2. Cache MISS -> Chỉ cho 1 request của cùng key đi xuống DB tại một thời điểm trên instance này
        var lockEntry = AcquireLockEntry(key);
        var acquired = false;
        try
        {
            await lockEntry.Semaphore.WaitAsync(ct);
            acquired = true;

            // Kiểm tra lại lần 2 vì có thể request vừa vào trước đó đã nạp cache xong
            cached = await TryGetAsync<T>(key, ct);
            if (cached.Found)
            {
                logger.LogDebug("[CACHE HIT AFTER LOCK] Key: {Key}", key);
                return cached.Value;
            }

            logger.LogDebug("[CACHE MISS] Key: {Key}. Đang truy vấn từ Database...", key);
            var value = await factory();

            if (value is not null)
            {
                // Mặc định lưu 12 giờ theo yêu cầu SCRUM-80
                var ttl = expiration ?? TimeSpan.FromHours(12);
                await TrySetAsync(key, value, ttl, ct);
            }

            return value;
        }
        finally
        {
            if (acquired)
                lockEntry.Semaphore.Release();
            ReleaseLockEntry(key, lockEntry);
        }
    }

    public async Task RemoveAsync(string key, CancellationToken ct = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(key);

        try
        {
            await distributedCache.RemoveAsync(key, ct);
            logger.LogInformation("[CACHE EVICT] Đã xóa key: {Key}", key);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "[CACHE EVICT ERROR] Không thể xóa key {Key} trên Distributed Cache.", key);
        }
    }

    private async Task<(bool Found, T? Value)> TryGetAsync<T>(string key, CancellationToken ct)
    {
        string? raw;
        try
        {
            raw = await distributedCache.GetStringAsync(key, ct);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "[CACHE READ ERROR] Lỗi đọc Distributed Cache cho key {Key}. Fallback xuống DB.", key);
            return (false, default);
        }

        if (string.IsNullOrEmpty(raw))
            return (false, default);

        try
        {
            var value = JsonSerializer.Deserialize<T>(raw, JsonOptions);
            return value is not null ? (true, value) : (false, default);
        }
        catch (JsonException ex)
        {
            logger.LogWarning(ex, "[CACHE CORRUPT] Payload JSON không hợp lệ tại key {Key}. Xóa và nạp lại.", key);
            await RemoveSafeAsync(key, ct);
            return (false, default);
        }
    }

    private async Task TrySetAsync<T>(string key, T value, TimeSpan ttl, CancellationToken ct)
    {
        try
        {
            var payload = JsonSerializer.Serialize(value, JsonOptions);
            var options = new DistributedCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = ttl
            };
            await distributedCache.SetStringAsync(key, payload, options, ct);
            logger.LogInformation("[CACHE SET] Key: {Key} đã lưu với TTL: {TTL}", key, ttl);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "[CACHE WRITE ERROR] Không thể ghi Distributed Cache cho key {Key}.", key);
        }
    }

    private async Task RemoveSafeAsync(string key, CancellationToken ct)
    {
        try
        {
            await distributedCache.RemoveAsync(key, ct);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch
        {
            // Bỏ qua lỗi dọn key lỗi để không chặn luồng chính fallback về DB.
        }
    }

    private LockEntry AcquireLockEntry(string key)
    {
        lock (_locks)
        {
            if (!_locks.TryGetValue(key, out var entry))
            {
                entry = new LockEntry();
                _locks[key] = entry;
            }
            entry.RefCount++;
            return entry;
        }
    }

    private void ReleaseLockEntry(string key, LockEntry entry)
    {
        var shouldDispose = false;
        lock (_locks)
        {
            entry.RefCount--;
            if (entry.RefCount == 0 && _locks.TryGetValue(key, out var current) && ReferenceEquals(current, entry))
            {
                _locks.Remove(key);
                shouldDispose = true;
            }
        }
        if (shouldDispose)
            entry.Semaphore.Dispose();
    }
}
