using Google.Apis.Auth;
using Microsoft.Extensions.Configuration;
using Parking.Identity.Application.Common.AppException;
using Parking.Identity.Application.Common.Enum;
using Parking.Identity.Application.Common.Interface;
using Parking.Identity.Application.DTOs;

namespace Parking.Identity.Infrastructure.Service.Google
{
    public class GoogleTokenValidator : IGoogleTokenValidator
    {
        private readonly string? clientId;
        public GoogleTokenValidator(IConfiguration configuration)
        {
            clientId = configuration["Google:ClientId"];

            if (string.IsNullOrWhiteSpace(clientId))
            {
                throw new AppException(ErrorCode.ClientIDNotFound, "Google:ClientId is not configured.");
            }
        }
        public async Task<GoogleUserDto> ValidateAsync(string idToken, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(idToken))
            {
                throw new ArgumentException("Google ID Token is required.", nameof(idToken));
            }

            var settings = new GoogleJsonWebSignature.ValidationSettings
            {
                Audience = new[]
                {
                    clientId
                }
            };

            var payload = await GoogleJsonWebSignature.ValidateAsync(idToken, settings);

            return new GoogleUserDto
            (
                GoogleSubject: payload.Subject,
                Email: payload.Email,
                EmailVerified: payload.EmailVerified,
                FullName: payload.Name
            );
        }
    }
}
