using Parking.Identity.Domain.Entities;

namespace Parking.Identity.Application.Common.Interface
{
    public interface IPasswordHasherService
    {
        string HashPassword(AppUser appUser, string password);
        bool VerifiedPassword(AppUser appUser, string password, string passwordHash);
    }
}
