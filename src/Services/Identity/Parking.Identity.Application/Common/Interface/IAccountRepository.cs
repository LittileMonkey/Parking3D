using Parking.Identity.Domain.Entities;


namespace Parking.Identity.Application.Common.Interface
{
    public interface IAccountRepository
    {
        Task<AppUser> Register(AppUser appUser);
        Task<AppUser> UpdateAccount(AppUser appUser);
        Task<IEnumerable<AppUser>> GetAllAccountUser();

        Task<AppUser> GetUserByIdAsync(Guid userId, CancellationToken cancellationToken);
        Task<AppUser> GetUserByEmail(string email);

        Task<bool> DeleteUserById(string userId);

        Task<AppUser> GetUserByPhone(string phone);
    }
}
