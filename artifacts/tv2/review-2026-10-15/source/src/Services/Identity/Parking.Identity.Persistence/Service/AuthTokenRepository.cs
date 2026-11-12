using Parking.Identity.Application.Common.Interface;
using Parking.Identity.Domain.Entities;
using Parking.Identity.Persistence.DataAccessLayer;
using Microsoft.EntityFrameworkCore;

namespace Parking.Identity.Persistence.Service
{
    public class AuthTokenRepository : IAuthTokenRepository
    {
        private readonly ParkingDatabaseV4Context context;
        public AuthTokenRepository(ParkingDatabaseV4Context context)
        {
            this.context = context;
        }
        public async Task AddAsync(AuthToken authToken, CancellationToken cancellationToken)
        {
            await context.AuthTokens.AddAsync(authToken);
            await context.SaveChangesAsync(cancellationToken);
        }

        public async Task<AuthToken?> GetByTokenHashAsync(string tokenHash, CancellationToken cancellationToken)
        {
            return await context.AuthTokens
                .FirstOrDefaultAsync(x => x.TokenHash == tokenHash, cancellationToken);
        }

        public async Task RevokedAsync(AuthToken authToken, CancellationToken cancellationToken)
        {
            authToken.RevokedAt = DateTime.UtcNow;
            await context.SaveChangesAsync(cancellationToken);
        }

        public async Task RevokedFamilyAsync(Guid familyId, CancellationToken cancellationToken)
        {
            var tokens = await context.AuthTokens
           .Where(x =>
               x.FamilyId == familyId &&
               x.RevokedAt == null)
           .ToListAsync(cancellationToken);

            foreach (var token in tokens)
            {
                token.RevokedAt = DateTime.UtcNow;
            }

            await context.SaveChangesAsync(cancellationToken);
        }
    }
}
