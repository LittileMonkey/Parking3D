using Parking.Identity.Application.Common.Interface;
using Parking.Identity.Domain.Entities;
using Parking.Identity.Persistence.DataAccessLayer;

namespace Parking.Identity.Persistence.Repositories
{
    public class AuditLogRepository : IAuditLogRepository
    {
        private readonly ParkingDatabaseV4Context _context;

        public AuditLogRepository(ParkingDatabaseV4Context context)
        {
            _context = context;
        }

        public async Task AddAsync(AuditLog auditLog, CancellationToken cancellationToken = default)
        {
            await _context.AuditLogs.AddAsync(auditLog, cancellationToken);
        }
    }
}
