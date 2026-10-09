using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Parking.Parking.Application;

namespace Parking.Parking.Infrastructure;

public sealed class HoldExpiryWorker(IParkingRepository repo, ILogger<HoldExpiryWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("HoldExpiryWorker started with 10-second sweep cycle.");
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(10));
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                var expiredCount = await repo.ExpireHoldsAsync(stoppingToken);
                if (expiredCount > 0)
                {
                    logger.LogInformation("HoldExpiryWorker released {Count} expired reservations.", expiredCount);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogWarning("HoldExpiryWorker cycle encountered error: {Message}", ex.Message);
            }
        }
    }
}
