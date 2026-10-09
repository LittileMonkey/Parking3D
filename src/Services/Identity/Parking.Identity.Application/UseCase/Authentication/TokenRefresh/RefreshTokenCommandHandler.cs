using Parking.Identity.Application.Common.AppException;
using Parking.Identity.Application.Common.Enum;
using Parking.Identity.Application.Common.Interface;
using Parking.Identity.Application.DTOs;
using Parking.Identity.Domain.Entities;
using MediatR;

namespace Parking.Identity.Application.UseCase.Authentication.TokenRefresh
{
    public class RefreshTokenCommandHandler : IRequestHandler<RefreshTokenCommand, AuthenticationResponseDto>
    {
        private readonly IAccountRepository accountRepository;
        private readonly IAuthTokenRepository authTokenRepository;
        private readonly IAccessTokenService accessTokenService;
        public RefreshTokenCommandHandler(IAccountRepository accountRepository, IAuthTokenRepository authTokenRepository, IAccessTokenService accessTokenService)
        {
            this.accountRepository = accountRepository;
            this.authTokenRepository = authTokenRepository;
            this.accessTokenService = accessTokenService;
        }

        public async Task<AuthenticationResponseDto> Handle(RefreshTokenCommand request, CancellationToken cancellationToken)
        {
            // 1. Hash token từ client
            var tokenHash = accessTokenService.HashToken(request.refreshToken);
            // 2. Tìm token trong DB
            var authToken = await authTokenRepository.GetByTokenHashAsync(tokenHash, cancellationToken);

            if (authToken == null)
            {
                throw new AppException(ErrorCode.Unauthorized, "Refresh token is invalid.");
            }

            // 3. Check purpose
            if (authToken.Purpose != "RefreshToken")
            {
                throw new AppException(ErrorCode.Unauthorized, "Invalid token purpose.");
            }

            // 4. Check revoked
            if (authToken.RevokedAt != null)
            {
                throw new AppException(ErrorCode.Unauthorized, "Refresh token has been revoked.");
            }

            // 5. Check expiration
            if (authToken.ExpiresAt <= DateTime.UtcNow)
            {
                throw new AppException(ErrorCode.Unauthorized, "Refresh token has expired.");
            }

            // 6. Check consumed
            if (authToken.ConsumedAt != null)
            {
                // Token reuse detected
                await authTokenRepository.RevokedFamilyAsync(authToken.FamilyId, cancellationToken);
                throw new AppException(ErrorCode.Unauthorized, "Refresh token reuse detected.");

            }

            var user = await accountRepository.GetUserByIdAsync(authToken.UserId, cancellationToken);

            if (user != null)
            {
                throw new AppException(ErrorCode.AccountNotFound, "User does not exist.");
            }

            if (user.Status != "Active")
            {
                throw new AppException(ErrorCode.AccountNotFound, "User is inactive.");
            }

            // 8. Consume old refresh token
            authToken.ConsumedAt =
                DateTime.UtcNow;

            // 9. Generate new Access Token
            var newAccessToken = accessTokenService.GenerateAccessToken(user);

            // 10. Generate new Refresh Token
            var newRefreshToken = accessTokenService.GenerateRefreshToken();

            // 11. Hash new Refresh Token
            var newTokenHash =
                accessTokenService.HashToken(newRefreshToken);

            // 12. Save new Refresh Token
            var newAuthToken = new AuthToken
            {
                Id = Guid.NewGuid(),

                UserId = user.Id,

                TokenHash = newTokenHash,

                // IMPORTANT:
                // same family
                FamilyId = authToken.FamilyId,

                Purpose = "RefreshToken",

                ExpiresAt =
                    DateTime.UtcNow.AddDays(7),

                CreatedAt = DateTime.UtcNow
            };

            await authTokenRepository.AddAsync(
                newAuthToken,
                cancellationToken);

            return new AuthenticationResponseDto
            {
                UserId = user.Id,

                FullName = user.FullName,

                EmailNormalized = user.EmailNormalized,

                Role = user.PlatformUserRoles.FirstOrDefault()?.RoleCode ?? string.Empty,

                AccessToken = newAccessToken,

                RefreshToken = newRefreshToken
            };
        }
    }
}
