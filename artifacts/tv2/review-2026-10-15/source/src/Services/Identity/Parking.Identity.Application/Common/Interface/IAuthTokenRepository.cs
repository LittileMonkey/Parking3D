using Parking.Identity.Domain.Entities;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Identity.Application.Common.Interface
{
    public interface IAuthTokenRepository
    {
        Task AddAsync(AuthToken authToken, CancellationToken cancellationToken);
        Task<AuthToken?> GetByTokenHashAsync(string tokenHash, CancellationToken cancellationToken);
        Task RevokedAsync(AuthToken authToken, CancellationToken cancellationToken);
        Task RevokedFamilyAsync(Guid familyId, CancellationToken cancellationToken);

    }
}
