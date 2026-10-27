using Parking.Identity.Domain.Entities;

namespace Parking.Identity.Application.Common.Interface
{
    public interface IAuditLogRepository
    {
        Task AddAsync(AuditLog auditLog, CancellationToken cancellationToken = default);
    }
}
