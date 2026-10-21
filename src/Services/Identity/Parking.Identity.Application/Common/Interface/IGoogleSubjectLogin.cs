using Parking.Identity.Domain.Entities;

namespace Parking.Identity.Application.Common.Interface
{
    public interface IGoogleSubjectLogin
    {
        Task<AppUser> GetByGoogleSubject(string googleSubject, CancellationToken cancellationToken);
    }
}
