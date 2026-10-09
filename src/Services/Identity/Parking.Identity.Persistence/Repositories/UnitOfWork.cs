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

        public async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            return await context.SaveChangesAsync(cancellationToken);
        }
    }
}
