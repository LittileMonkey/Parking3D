using Parking.Identity.Domain.Entities;

namespace Parking.Identity.Application.Common.Interface
{
    public interface IAuthTokenRepository
    {
        Task AddAsync(AuthToken authToken, CancellationToken cancellationToken);
        Task<AuthToken?> GetByTokenHashAsync(string tokenHash, CancellationToken cancellationToken);
        Task RevokedAsync(AuthToken authToken, CancellationToken cancellationToken);
        Task RevokedFamilyAsync(Guid familyId, CancellationToken cancellationToken);
        Task RevokedAllByUserIdAsync(Guid userId, CancellationToken cancellationToken);

    }
}
