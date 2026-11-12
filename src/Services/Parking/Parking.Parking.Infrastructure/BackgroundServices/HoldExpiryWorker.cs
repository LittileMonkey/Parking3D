using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Parking.Parking.Application;

namespace Parking.Parking.Infrastructure.BackgroundServices;

// Quét booking quá hạn mỗi 10 giây; mỗi lượt tạo scope riêng cho Repository.
public sealed class HoldExpiryWorker(
    IServiceScopeFactory scopeFactory,
    ILogger<HoldExpiryWorker> logger) : BackgroundService
{
    private const int BatchSize = 100;
    private const int MaxBatchesPerTick = 20;

    /// <summary>Chạy một chu kỳ quét; tiếp tục hút thêm batch nếu lô hiện tại đầy để tránh tồn đọng.</summary>
    public async Task<int> ProcessCycleAsync(CancellationToken stoppingToken)
    {
        var totalExpired = 0;

        for (var batch = 0; batch < MaxBatchesPerTick; batch++)
        {
            await using var scope = scopeFactory.CreateAsyncScope();
            var repository = scope.ServiceProvider.GetRequiredService<IParkingRepository>();

            var expiredCount = await repository.ExpireHoldsAsync(stoppingToken);
            totalExpired += expiredCount;

            if (expiredCount < BatchSize || stoppingToken.IsCancellationRequested)
            {
                break;
            }
        }

        if (totalExpired > 0)
        {
            logger.LogInformation("Expired {Count} booking holds.", totalExpired);
        }

        return totalExpired;
    }

    /// <summary>Quét hold mỗi 10 giây với scope riêng mỗi lượt; hỗ trợ hủy khi tắt ứng dụng và ghi lỗi để lượt sau tiếp tục.</summary>
    protected override async Task ExecuteAsync(
        CancellationToken stoppingToken)
    {
        logger.LogInformation("Hold expiry worker started.");

        using var timer = new PeriodicTimer(
            TimeSpan.FromSeconds(10));

        try
        {
            while (await timer.WaitForNextTickAsync(stoppingToken))
            {
                try
                {
                    await ProcessCycleAsync(stoppingToken);
                    await using (var scope = scopeFactory.CreateAsyncScope())
                    {
                        var repository = scope.ServiceProvider.GetRequiredService<IParkingRepository>();
                        var noShows = await repository.ExpireNoShowsAsync(stoppingToken);
                        if (noShows > 0) logger.LogInformation("Marked {Count} bookings no-show.", noShows);
                    }
                }
                catch (OperationCanceledException)
                    when (stoppingToken.IsCancellationRequested)
                {
                    break;
                }
                catch (Exception exception)
                {
                    logger.LogError(
                        exception,
                        "Failed to process expired booking holds.");
                }
            }
        }
        catch (OperationCanceledException)
            when (stoppingToken.IsCancellationRequested)
        {
            // Dừng chờ timer khi ứng dụng đang tắt.
        }

        logger.LogInformation("Hold expiry worker stopped.");
    }
}