using Parking.Identity.Application.Common.Interface;
using Parking.Identity.Domain.Entities;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;

namespace Parking.Identity.Persistence.Service
{
    public class AccessTokenService : IAccessTokenService
    {
        private readonly IConfiguration configuration;
        public AccessTokenService(IConfiguration _configuration)
        {
            this.configuration = _configuration;
        }
        public string GenerateAccessToken(AppUser appUser)
        {
            var jwt = configuration.GetSection("Jwt");

            var key = jwt["Key"]!;
            var issuer = jwt["Issuer"]!;
            var audience = jwt["Audience"]!;

            var claim = new List<Claim>
            {
                new(JwtRegisteredClaimNames.Sub , appUser.Id.ToString()),
                new(JwtRegisteredClaimNames.Email, appUser.EmailNormalized ?? string.Empty),
                new(JwtRegisteredClaimNames.PhoneNumber, appUser.PhoneE164 ?? string.Empty),
                new(ClaimTypes.Name , appUser.FullName),
                new("tokenType", "access")
            };

            if (appUser.PlatformUserRoles != null)
            {
                foreach (var userRole in appUser.PlatformUserRoles)
                {
                    if (!string.IsNullOrEmpty(userRole.RoleCode))
                    {
                        claim.Add(new(ClaimTypes.Role, userRole.RoleCode));
                    }
                }
            }

            var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key));

            var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);

            var token = new JwtSecurityToken(
                issuer: issuer,
                audience: audience,
                claims: claim,
                expires: DateTime.UtcNow.AddMinutes(double.Parse(jwt["AccessTokenExpirationMinutes"])),
                signingCredentials: credentials
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }
        public string GenerateRefreshToken()
        {
            var randomBytes = RandomNumberGenerator.GetBytes(32);
            return Convert.ToBase64String(randomBytes);
        }

        public Guid? GetUserIdFromAccessToken(string token)
        {
            try
            {
                var handler = new JwtSecurityTokenHandler();

                var jwtToken = handler.ReadJwtToken(token);

                var userId = jwtToken.Claims.FirstOrDefault(x => x.Type == JwtRegisteredClaimNames.Sub)?.Value;

                if (Guid.TryParse(userId, out var guidId))
                {
                    return guidId;
                }
                return null;

            }
            catch
            {
                return null;
            }
        }

        public string HashToken(string token)
        {
            var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(token));

            return Convert.ToHexString(bytes);
        }

        public bool VerifyToken(string token)
        {
            var jwt = configuration.GetSection("Jwt");
            var key = jwt["Key"]!;
            var issuer = jwt["Issuer"]!;
            var audience = jwt["Audience"]!;

            var tokenHandler = new JwtSecurityTokenHandler();

            try
            {
                tokenHandler.ValidateToken(token, new TokenValidationParameters
                {
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)),

                    ValidateIssuer = true,
                    ValidIssuer = issuer,

                    ValidateAudience = true,
                    ValidAudience = audience,

                    ValidateLifetime = true,

                    ClockSkew = TimeSpan.Zero

                },

                out _);

                return true;
            }
            catch
            {
                return false;
            }

        }
    }
}
