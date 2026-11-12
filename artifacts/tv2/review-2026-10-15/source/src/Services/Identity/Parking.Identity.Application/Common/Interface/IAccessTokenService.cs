using Parking.Identity.Domain.Entities;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

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
