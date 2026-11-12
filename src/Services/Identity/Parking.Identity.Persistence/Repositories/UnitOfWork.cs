using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Parking.Identity.Application.Common.Interface;
using Parking.Identity.Persistence.DataAccessLayer;

namespace Parking.Identity.Persistence.Repositories;

public class UnitOfWork(ParkingDatabaseV4Context context) : IUnitOfWork
{
    public Task<IDbContextTransaction> BeginTransactionAsync(CancellationToken cancellationToken = default) =>
        context.Database.BeginTransactionAsync(cancellationToken);

    public async Task AcquireLockAsync(string resource, CancellationToken cancellationToken = default)
    {
        if(context.Database.CurrentTransaction is null)throw new InvalidOperationException("Resource lock requires a transaction");
        await context.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock(hashtext({resource}))",cancellationToken);
    }

    public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default) =>
        context.SaveChangesAsync(cancellationToken);
}
