using Parking.Identity.Domain.Entities;

namespace Parking.Identity.Application.Common.Interface
{
    public interface IAccessTokenService
    {
        string GenerateAccessToken(AppUser user);

        string GenerateRefreshToken();

        string HashToken(string token);

        bool VerifyToken(string token);

        Guid? GetUserIdFromAccessToken(string token);
    }
}
