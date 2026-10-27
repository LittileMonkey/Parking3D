using Microsoft.EntityFrameworkCore;
using Parking.Identity.Application.Common.Interface;
using Parking.Identity.Domain.Entities;
using Parking.Identity.Persistence.DataAccessLayer;

namespace Parking.Identity.Persistence.Service.Google
{
    public class GoogleSubjectLogin : IGoogleSubjectLogin
    {
        private readonly ParkingDatabaseV4Context context;
        public GoogleSubjectLogin(ParkingDatabaseV4Context context)
        {
            this.context = context;
        }
        public async Task<AppUser?> GetByGoogleSubject(string googleSubject, CancellationToken cancellationToken)
        {
            return await context.AppUsers
                .Include(x => x.PlatformUserRoles)
                .FirstOrDefaultAsync(x => x.GoogleSubject == googleSubject, cancellationToken);
        }
    }
}
