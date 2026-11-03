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
                    await using var scope =
                        scopeFactory.CreateAsyncScope();

                    var repository = scope.ServiceProvider
                        .GetRequiredService<IParkingRepository>();

                    var expiredCount = await repository
                        .ExpireHoldsAsync(stoppingToken);

                    if (expiredCount > 0)
                    {
                        logger.LogInformation(
                            "Expired {Count} booking holds.",
                            expiredCount);
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