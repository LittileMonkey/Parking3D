using Parking.Identity.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Parking.Identity.Persistence.DataAccessLayer;
using Parking.Identity.Application.Common.Interface;

namespace Parking.Identity.Persistence.Repositories
{
    public class AccountRepository : IAccountRepository
    {
        private readonly ParkingDatabaseV4Context _context;
        public AccountRepository(ParkingDatabaseV4Context context)
        {
            this._context = context;
        }
        public async Task<bool> DeleteUserById(string userId)
        {
            if (!Guid.TryParse(userId, out var guidId))
            {
                return false;
            }

            var user = await _context.AppUsers.FindAsync(guidId);

            if (user == null)
            {
                return false;
            }

            _context.Remove(user);
            return true;

        }

        public async Task<IEnumerable<AppUser>> GetAllAccountUser()
        {
            return await _context.AppUsers.AsNoTracking().Include(r => r.PlatformUserRoles).ToListAsync();
        }

        public async Task<AppUser> GetUserByEmail(string email)
        {
            return await _context.AppUsers
                .AsNoTracking()
                .Include(r => r.PlatformUserRoles)
                .FirstOrDefaultAsync(e => e.EmailNormalized == email);
        }

        public async Task<AppUser> GetUserByIdAsync(Guid userId, CancellationToken cancellationToken)
        {
            return await _context.AppUsers
                .Include(r => r.PlatformUserRoles)
                .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);
        }

        public async Task<AppUser> GetUserByPhone(string phone)
        {
            return await _context.AppUsers
                 .AsNoTracking()
                 .FirstOrDefaultAsync(x => x.PhoneE164 == phone);
        }

        public async Task<AppUser> Register(AppUser appUser)
        {
            await _context.AddAsync(appUser);
            return appUser;

        }

        public async Task<AppUser> UpdateAccount(AppUser appUser)
        {
            _context.AppUsers.Update(appUser);
            return await Task.FromResult(appUser);
        }
    }
}
