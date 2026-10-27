using Parking.Identity.Domain.Entities;

namespace Parking.Identity.Application.Common.Interface
{
    public interface IUserMembershipRepository
    {
        Task<UserMembership?> GetUserMembershipByUserIdAsync(Guid userId, CancellationToken ct);

        Task AddUserMembershipAsync(UserMembership membership, CancellationToken ct);

        void UpdateUserMembership(UserMembership membership);
    }
}
