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

        public async Task<AuthenticationResponseDto> Handle(
     RefreshTokenCommand request,
     CancellationToken cancellationToken)
        {
            // 1. Validate input
            if (string.IsNullOrWhiteSpace(request.refreshToken))
            {
                throw new AppException(
                    ErrorCode.Unauthorized,
                    "Refresh token is required.");
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
                    ErrorCode.Unauthorized,
                    "Refresh token is invalid.");
            }

            // 4. Kiểm tra purpose
            if (authToken.Purpose != "RefreshToken")
            {
                throw new AppException(
                    ErrorCode.Unauthorized,
                    "Invalid token purpose.");
            }

            // 5. Kiểm tra token đã bị thu hồi
            if (authToken.RevokedAt != null)
            {
                throw new AppException(
                    ErrorCode.Unauthorized,
                    "Refresh token has been revoked.");
            }

            // 6. Kiểm tra thời hạn
            if (authToken.ExpiresAt <= DateTime.UtcNow)
            {
                throw new AppException(
                    ErrorCode.Unauthorized,
                    "Refresh token has expired.");
            }

            // 7. Phát hiện token đã được sử dụng
            if (authToken.ConsumedAt != null)
            {
                await authTokenRepository.RevokedFamilyAsync(
                    authToken.FamilyId,
                    cancellationToken);

                throw new AppException(
                    ErrorCode.Unauthorized,
                    "Refresh token reuse detected.");
            }

            // 8. Tìm user sở hữu refresh token
            var user = await accountRepository.GetUserByIdAsync(
                authToken.UserId,
                cancellationToken);

            if (user == null)
            {
                throw new AppException(
                    ErrorCode.AccountNotFound,
                    "User does not exist.");
            }

            // 9. Kiểm tra trạng thái tài khoản
            if (user.Status != AppUserStatus.Active)
            {
                throw new AppException(
                    ErrorCode.Unauthorized,
                    "User is inactive.");
            }

            // 10. Đánh dấu token cũ đã sử dụng
            authToken.ConsumedAt = DateTime.UtcNow;

            // TODO: Lưu authToken.ConsumedAt bằng repository.
            // Tốt nhất thực hiện cùng transaction với bước tạo token mới.

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

            await authTokenRepository.AddAsync(
                newAuthToken,
                cancellationToken);

            // 14. Trả về thông tin xác thực mới
            return new AuthenticationResponseDto
            {
                UserId = user.Id,
                FullName = user.FullName,
                EmailNormalized = user.EmailNormalized,
                Role = user.PlatformUserRoles
                    .FirstOrDefault()?.RoleCode ?? string.Empty,
                AccessToken = newAccessToken,
                RefreshToken = newRefreshToken
            };
        }
    }
}
