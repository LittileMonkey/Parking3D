using Microsoft.EntityFrameworkCore.Storage;
using Parking.Identity.Application.Common.Interface;
using Parking.Identity.Persistence.DataAccessLayer;

namespace Parking.Identity.Persistence.Repositories
{
    public class UnitOfWork : IUnitOfWork
    {
        private readonly ParkingDatabaseV4Context context;
        public UnitOfWork(ParkingDatabaseV4Context context)
        {
            this.context = context;
        }

        public async Task<IDbContextTransaction> BeginTransactionAsync(CancellationToken cancellationToken = default)
        {
            return await context.Database.BeginTransactionAsync(cancellationToken);
        }

        public async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            Console.WriteLine("========== EF CHANGE TRACKER ==========");

            foreach (var entry in context.ChangeTracker.Entries())
            {
                Console.WriteLine(
                    $"Entity: {entry.Metadata.ClrType.Name} | " +
                    $"State: {entry.State} | " +
                    $"Key: {string.Join(", ", entry.Properties
                        .Where(p => p.Metadata.IsPrimaryKey())
                        .Select(p => $"{p.Metadata.Name}={p.CurrentValue}"))}");
            }

            Console.WriteLine("========== SAVE CHANGES ==========");

            return await context.SaveChangesAsync(cancellationToken);
        }
    }
}
