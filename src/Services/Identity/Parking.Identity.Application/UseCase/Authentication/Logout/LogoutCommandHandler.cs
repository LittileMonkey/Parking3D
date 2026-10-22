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
            if (string.IsNullOrWhiteSpace(request.RefreshToken))
            {
                throw new AppException(ErrorCode.TokenMissing, "Authentication token is missing from the request.");
            }
            // Hash Refresh Token
            var tokenHash = accessToken.HashToken(request.RefreshToken);
           
            // Tìm Refresh Token trong DB
            var authToken =
                await authTokenRepository.GetByTokenHashAsync(tokenHash, cancellationToken);

            if (authToken == null)
            {
                throw new AppException(ErrorCode.InvalidToken, "The provided refresh token is invalid.");
            }

            //Đã revoke rồi
            if (authToken.RevokedAt != null)
            {
                throw new AppException(ErrorCode.InvalidToken, "The refresh token has already been revoked.");
            }

            //Revoke
           await authTokenRepository.RevokedAsync(authToken, cancellationToken);
        }
    }
}
