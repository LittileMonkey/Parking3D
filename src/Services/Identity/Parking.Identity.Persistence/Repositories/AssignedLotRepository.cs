using Microsoft.EntityFrameworkCore;
using Parking.Identity.Application.Common.Interface;
using Parking.Identity.Domain.Entities;
using Parking.Identity.Persistence.DataAccessLayer;
namespace Parking.Identity.Persistence.Repositories
{
    public class AssignedLotRepository : IAssignedLotRepository
    {
        private readonly ParkingDatabaseV4Context context;
        public AssignedLotRepository(ParkingDatabaseV4Context context)
        {
            this.context = context;
        }

        public async Task AddStaffAssignmentAsync(LotStaffAssignment lotStaffAssignment, CancellationToken cancellationToken)
        {
            await context.LotStaffAssignments.AddAsync(lotStaffAssignment, cancellationToken);
        }

        public async Task<IReadOnlyList<LotStaffAssignment>> GetActiveStaffAssignedById(Guid userId, CancellationToken cancellationToken)
        {
            var now = DateTime.UtcNow;

            return await context.LotStaffAssignments
                .AsNoTracking()
                .Where(x => x.UserId == userId &&
                x.RevokedAt == null && 
                x.ValidFrom <= now &&
                (x.ValidUntil == null || x.ValidUntil > now))
                .ToListAsync(cancellationToken);
        }

        public async Task<LotStaffAssignment?> GetAssignmentByIdAsync(Guid assignmentId, CancellationToken cancellationToken)
        {
            return await context.LotStaffAssignments.FirstOrDefaultAsync(x => x.Id == assignmentId, cancellationToken);
        }

        public async Task<bool> HasActiveAssignmentAsync(Guid userId, Guid lotId, string? RoleCode, CancellationToken cancellationToken)
        {
            var now = DateTime.UtcNow;

            var query = context.LotStaffAssignments
                .Where(x => x.UserId == userId &&
                x.LotId == lotId &&
                x.RevokedAt == null &&
                x.ValidFrom <= now &&
                (x.ValidUntil == null || x.ValidUntil > now));

            if(RoleCode is not null)
            {
                query = query.Where(x => x.RoleCode == RoleCode);
            }

            return await query.AnyAsync(cancellationToken);
        }

        public async Task<bool> CanRevokeStaffAsync(Guid userId, Guid lotId,CancellationToken cancellationToken)
        {
            // 1. Kiểm tra ADMIN toàn hệ thống
            var isAdmin = await context.PlatformUserRoles
                .AsNoTracking()
                .AnyAsync(x =>
                    x.UserId == userId && x.RoleCode == "ADMIN", cancellationToken);

            if (isAdmin)
                return true;

            // 2. Kiểm tra MANAGER có quyền quản lý assignment tại bãi này
            var now = DateTime.UtcNow;

            return await context.LotStaffAssignments
                .AsNoTracking()
                .AnyAsync(x =>
                    x.UserId == userId &&
                    x.LotId == lotId &&
                    x.RoleCode == "PARKING_MANAGER" &&
                    x.CanManageStaffAssignments &&
                    x.RevokedAt == null &&
                    x.ValidFrom <= now &&
                    (x.ValidUntil == null || x.ValidUntil > now),
                    cancellationToken);
        }

        public async Task<bool> CheckAccessAsync(Guid userId, Guid lotId, string capability, CancellationToken cancellationToken)
        {
            if (userId == Guid.Empty || capability is not ("USER" or "ADMIN" or "OCR" or "GATE" or "CASH" or "REPORT" or "LOOKUP" or "CHECK_IN"))
                return false;

            var now = DateTime.UtcNow;

            var userActive = await context.AppUsers
                .AsNoTracking()
                .AnyAsync(u => u.Id == userId && u.Status == "ACTIVE" && (u.LockedUntil == null || u.LockedUntil <= now), cancellationToken);

            if (!userActive) return false;

            return capability switch
            {
                "USER" => true,
                "ADMIN" => await context.PlatformUserRoles
                    .AsNoTracking()
                    .AnyAsync(r => r.UserId == userId && r.RoleCode == "ADMIN", cancellationToken),
                "OCR" or "GATE" or "CASH" or "LOOKUP" or "CHECK_IN" => await context.LotStaffAssignments
                    .AsNoTracking()
                    .AnyAsync(a => a.UserId == userId
                                && a.LotId == lotId
                                && a.RevokedAt == null
                                && a.ValidFrom <= now
                                && (a.ValidUntil == null || now < a.ValidUntil)
                                && (a.RoleCode == "PARKING_STAFF" || a.RoleCode == "PARKING_MANAGER"), cancellationToken),
                "REPORT" => await context.LotStaffAssignments
                    .AsNoTracking()
                    .AnyAsync(a => a.UserId == userId
                                && a.LotId == lotId
                                && a.RevokedAt == null
                                && a.ValidFrom <= now
                                && (a.ValidUntil == null || now < a.ValidUntil)
                                && a.RoleCode == "PARKING_MANAGER", cancellationToken),
                _ => false
            };
        }
    }
}
