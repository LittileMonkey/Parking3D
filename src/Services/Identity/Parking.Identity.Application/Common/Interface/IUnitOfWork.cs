using Microsoft.EntityFrameworkCore.Storage;

namespace Parking.Identity.Application.Common.Interface
{
    public interface IUnitOfWork
    {
        Task AcquireLockAsync(string resource, CancellationToken cancellationToken = default);
        Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
        Task<IDbContextTransaction> BeginTransactionAsync(CancellationToken cancellationToken = default);
    }
}
