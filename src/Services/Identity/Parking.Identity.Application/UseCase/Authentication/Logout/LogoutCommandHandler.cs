using Parking.Identity.Application.Common.AppException;
using Parking.Identity.Application.Common.Enum;
using Parking.Identity.Application.Common.Interface;
using MediatR;

namespace Parking.Identity.Application.UseCase.Authentication.Logout
{
    public class LogoutCommandHandler : IRequestHandler<LogoutCommand>
    {
        private readonly IAuthTokenRepository authTokenRepository;
        private readonly IAccessTokenService accessToken;
        public LogoutCommandHandler(IAuthTokenRepository repository, IAccessTokenService tokenService)
        {
            this.authTokenRepository = repository;
            this.accessToken = tokenService;
        }
        public async Task Handle(LogoutCommand request, CancellationToken cancellationToken)
        {
            // Hash Refresh Token
            var tokenHash = accessToken.HashToken(request.RefreshToken);

            // Tìm Refresh Token trong DB
            var authToken =
                await authTokenRepository
                    .GetByTokenHashAsync(
                        tokenHash,
                        cancellationToken);

            if (authToken == null)
            {
                throw new AppException(ErrorCode.Unauthorized, "Refresh token không hợp lệ.");
            }

            //Đã revoke rồi
            if (authToken.RevokedAt != null)
            {
                throw new AppException(ErrorCode.Unauthorized, "Refresh token đã bị revoke.");
            }

            //Revoke
           await authTokenRepository.RevokedAsync(authToken, cancellationToken);
        }
    }
}
