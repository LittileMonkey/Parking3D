using Microsoft.EntityFrameworkCore;
using Parking.Identity.Application.Common.Interface;
using Parking.Identity.Domain.Entities;
using Parking.Identity.Persistence.DataAccessLayer;

namespace Parking.Identity.Persistence.Repositories
{
    public class PasswordResetOtpRepository : IPasswordResetOtpRepository
    {
        private readonly ParkingDatabaseV4Context context;
        public PasswordResetOtpRepository(ParkingDatabaseV4Context context)
        {
            this.context = context;
        }
        public async Task AddNewOtpAsync(PasswordResetOtp otp, CancellationToken cancellationToken)
        {
            await context.PasswordResetOtps.AddAsync(otp, cancellationToken);
        }

        public async Task<PasswordResetOtp> GetLatestUnusedOtpAsync(Guid userId, CancellationToken cancellationToken)
        {
            var now = DateTimeOffset.UtcNow;
            return await context.PasswordResetOtps
                .AsNoTracking()
                .Where(x => x.UserId == userId && x.UsedAt == null && x.ExpiresAt > now)
                .OrderByDescending(x => x.CreatedAt)
                .FirstOrDefaultAsync(cancellationToken);
        }

        public async Task InvalidateActiveOtpsAsync(Guid userId, CancellationToken cancellationToken)
        {
            var now = DateTimeOffset.UtcNow;

            var otps = await context.PasswordResetOtps
                .Where(x => x.UserId == userId
                && x.UsedAt == null
                && x.ExpiresAt > now)
                .ExecuteUpdateAsync(s => s.SetProperty(x => x.UsedAt, now), cancellationToken);
        }
    }
}
