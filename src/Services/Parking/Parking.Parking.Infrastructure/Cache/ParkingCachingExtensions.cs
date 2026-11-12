using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Parking.Parking.Application.Interfaces;
using StackExchange.Redis;

namespace Parking.Parking.Infrastructure.Cache;

/// <summary>
/// Cấu hình Distributed Cache (Redis) cho Parking Service theo chuẩn SCRUM-80 & S4-09.
/// </summary>
public static class ParkingCachingExtensions
{
    /// <summary>
    /// Đăng ký <see cref="IParkingCacheService"/> dùng Redis (<c>ConnectionStrings:Redis</c> hoặc <c>Redis:ConnectionString</c>),
    /// tự fallback sang <c>AddDistributedMemoryCache()</c> khi chưa cấu hình Redis server ở local.
    /// </summary>
    public static IServiceCollection AddParkingCaching(this IServiceCollection services, IConfiguration configuration)
    {
        var redisConnection = configuration.GetConnectionString("Redis");
        if (string.IsNullOrWhiteSpace(redisConnection))
            redisConnection = configuration["Redis:ConnectionString"];

        if (!string.IsNullOrWhiteSpace(redisConnection))
        {
            var instanceName = configuration["Redis:InstanceName"];
            var configOptions = ConfigurationOptions.Parse(redisConnection);
            if (!redisConnection.Contains("abortConnect", StringComparison.OrdinalIgnoreCase))
                configOptions.AbortOnConnectFail = false;

            services.AddStackExchangeRedisCache(options =>
            {
                options.ConfigurationOptions = configOptions;
                options.InstanceName = string.IsNullOrWhiteSpace(instanceName) ? "parking:" : instanceName;
            });
        }
        else
        {
            services.AddDistributedMemoryCache();
        }

        services.AddSingleton<IParkingCacheService, ParkingCacheService>();
        return services;
    }
}
