using Microsoft.EntityFrameworkCore;
using ParkingProject.Data;
namespace ParkingProject.Services;

public class HoldExpiryWorker(IServiceScopeFactory scopes, ILogger<HoldExpiryWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(10));
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                using var scope = scopes.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<ParkingDbContext>();
                var service = scope.ServiceProvider.GetRequiredService<BookingService>();
                await using var transaction = await db.Database.BeginTransactionAsync(stoppingToken);
                await service.LockAsync(stoppingToken);
                await service.ExpireAsync(stoppingToken);
                await transaction.CommitAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception ex) { logger.LogError(ex, "Không thể giải phóng booking hết hạn. Kiểm tra database."); }
        }
    }
}
