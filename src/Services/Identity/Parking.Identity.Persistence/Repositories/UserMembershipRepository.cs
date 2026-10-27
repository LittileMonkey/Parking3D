using Microsoft.EntityFrameworkCore;
using Parking.Identity.Application.Common.Interface;
using Parking.Identity.Domain.Entities;
using Parking.Identity.Persistence.DataAccessLayer;

namespace Parking.Identity.Persistence.Repositories
{
    public class UserMembershipRepository : IUserMembershipRepository
    {
        private readonly ParkingDatabaseV4Context context;
        public UserMembershipRepository(ParkingDatabaseV4Context context)
        {
            this.context = context;
        }
        public async Task AddUserMembershipAsync(UserMembership membership, CancellationToken ct)
        {
            await context.UserMemberships.AddAsync(membership, ct);
        }

        public Task<UserMembership?> GetUserMembershipByUserIdAsync(Guid userId, CancellationToken ct)
        {
            return context.UserMemberships
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.UserId == userId, ct);
        }

        public void UpdateUserMembership(UserMembership membership)
        {
            context.UserMemberships.Update(membership);
        }
    }
}
