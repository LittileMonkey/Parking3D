using Parking.Identity.Application.Common.AppException;
using Parking.Identity.Application.Common.Enum;
using Parking.Identity.Application.Common.Interface;
using Parking.Identity.Application.DTOs;
using Parking.Identity.Domain.Entities;
using MediatR;
using Parking.Identity.Application.Common.Constants;

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
            // 1. Validate input
            if (string.IsNullOrWhiteSpace(request.refreshToken))
            {
                throw new AppException( ErrorCode.TokenMissing, "Authentication refresh token is required.");
            }

            // 2. Hash token từ client
            var tokenHash = accessTokenService.HashToken(
                request.refreshToken);

            // 3. Tìm refresh token trong database
            var authToken = await authTokenRepository.GetByTokenHashAsync(
                tokenHash,
                cancellationToken);

            if (authToken == null)
            {
                throw new AppException(
                    ErrorCode.InvalidToken,
                    "The provided refresh token is invalid.");
            }

            // 4. Kiểm tra purpose
            if (authToken.Purpose != "RefreshToken")
            {
                throw new AppException(
                    ErrorCode.InvalidToken,
                    "Invalid token purpose.");
            }

            // 5. Kiểm tra token đã bị thu hồi
            if (authToken.RevokedAt != null)
            {
                throw new AppException(
                    ErrorCode.InvalidToken,
                    "The refresh token has been revoked.");
            }

            // 6. Kiểm tra thời hạn
            if (authToken.ExpiresAt <= DateTime.UtcNow)
            {
                throw new AppException(
                    ErrorCode.TokenExpired,
                    "The authentication token has expired. Please sign in again.");
            }

            // 7. Phát hiện token đã được sử dụng
            if (authToken.ConsumedAt != null)
            {
                await authTokenRepository.RevokedFamilyAsync(
                    authToken.FamilyId,
                    cancellationToken);

                throw new AppException(
                    ErrorCode.InvalidToken,
                    "Refresh token reuse detected. All sessions have been revoked.");
            }

            // 8. Tìm user sở hữu refresh token
            var user = await accountRepository.GetUserByIdAsync(
                authToken.UserId,
                cancellationToken);

            if (user == null)
            {
                throw new AppException(
                    ErrorCode.AccountNotFound,
                    "The requested account could not be found.");
            }

            // 9. Kiểm tra trạng thái tài khoản
            if (user.Status != AppUserStatus.Active || user.LockedUntil > DateTime.UtcNow)
            {
                throw new AppException(
                    ErrorCode.AccountInactive,
                    "The account is currently inactive.");
            }

            // Consume and replace atomically below; concurrent refresh must not issue two sessions.

            // 11. Sinh access token mới
            var newAccessToken =
                accessTokenService.GenerateAccessToken(user);

            // 12. Sinh refresh token mới
            var newRefreshToken =
                accessTokenService.GenerateRefreshToken();

            var newTokenHash =
                accessTokenService.HashToken(newRefreshToken);

            // 13. Lưu refresh token mới trong cùng family
            var newAuthToken = new AuthToken
            {
                Id = Guid.NewGuid(),
                UserId = user.Id,
                TokenHash = newTokenHash,
                FamilyId = authToken.FamilyId,
                Purpose = "RefreshToken",
                ExpiresAt = DateTime.UtcNow.AddDays(7),
                CreatedAt = DateTime.UtcNow
            };

            if(!await authTokenRepository.RotateAsync(authToken.Id,newAuthToken,cancellationToken))
            {
                await authTokenRepository.RevokedFamilyAsync(authToken.FamilyId,cancellationToken);
                throw new AppException(ErrorCode.InvalidToken,"Refresh token was already consumed or revoked. Sign in again.");
            }

            // 14. Trả về thông tin xác thực mới
            return new AuthenticationResponseDto
            {
                AccessToken = newAccessToken,
                RefreshToken = newRefreshToken
            };
        }
    }
}
