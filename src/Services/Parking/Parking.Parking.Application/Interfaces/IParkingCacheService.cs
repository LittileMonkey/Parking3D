namespace Parking.Parking.Application.Interfaces;

/// <summary>
/// Hợp đồng cho dịch vụ lưu trữ đệm (Caching) cấu trúc bãi đỗ xe
/// </summary>
public interface IParkingCacheService
{
    /// <summary>
    /// Lấy dữ liệu từ cache nếu có; nếu chưa có thì chạy hàm factory để lấy từ DB và nạp vào cache.
    /// </summary>
    Task<T?> GetOrSetAsync<T>(
        string key,
        Func<Task<T?>> factory,
        TimeSpan? expiration = null,
        CancellationToken ct = default);

    /// <summary>
    /// Xóa cache của một key (dùng khi Manager sửa đổi cấu trúc bãi xe).
    /// </summary>
    Task RemoveAsync(string key, CancellationToken ct = default);
}

