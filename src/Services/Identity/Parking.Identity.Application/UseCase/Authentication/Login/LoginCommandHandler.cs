using Parking.Identity.Application.Common.AppException;
using Parking.Identity.Application.Common.Enum;
using Parking.Identity.Application.Common.Interface;
using Parking.Identity.Application.DTOs;
using MediatR;
using Parking.Identity.Domain.Entities;

namespace Parking.Identity.Application.UseCase.Authentication.Login
{
    public class LoginCommandHandler : IRequestHandler<LoginCommand, AuthenticationResponseDto>
    {
        private readonly IAccountRepository accountRepository;
        private readonly IAccessTokenService tokenService;
        private readonly IAuthTokenRepository authTokenRepository;
        private readonly IPasswordHasherService hasherService;

        public LoginCommandHandler(IAccountRepository repository, IAccessTokenService tokenService, IAuthTokenRepository authTokenRepository, IPasswordHasherService hasherService)
        {
            this.accountRepository = repository;
            this.tokenService = tokenService;
            this.authTokenRepository = authTokenRepository;
            this.hasherService = hasherService;
        }
        async Task<AuthenticationResponseDto> IRequestHandler<LoginCommand, AuthenticationResponseDto>.Handle(LoginCommand request, CancellationToken cancellationToken)
        {
            if (string.IsNullOrEmpty(request.Email))
            {
                throw new AppException(ErrorCode.InvalidEmail, "The provided email address is invalid.");
            }

            var email = request.Email.Trim().ToUpperInvariant();


            var user = await accountRepository.GetUserByEmail(email);

            if (user == null)
            {
                throw new AppException(ErrorCode.InvalidCredentials, "The email address or password is incorrect.");
            }

            if (user.Status != "ACTIVE")
            {
                throw new AppException(ErrorCode.AccountInactive, "The account is currently inactive.");
            }

            if(string.IsNullOrWhiteSpace(request.Password) || string.IsNullOrWhiteSpace(user.PasswordHash))
            {
                throw new AppException(ErrorCode.InvalidCredentials, "The email address or password is incorrect.");
            }
            var passwordValid = hasherService.VerifiedPassword(user, request.Password, user.PasswordHash);

            if (!passwordValid)
            {
                throw new AppException(ErrorCode.InvalidCredentials, "The email address or password is incorrect.");
            }

            var accessToken = tokenService.GenerateAccessToken(user);

            var refreshToken = tokenService.GenerateRefreshToken();

            var refreshTokenHash = tokenService.HashToken(refreshToken);

            var familyId = Guid.NewGuid();

            var authToken = new AuthToken
            {
                Id = Guid.NewGuid(),
                UserId = user.Id,
                TokenHash = refreshTokenHash,
                FamilyId = familyId,
                Purpose = "RefreshToken",
                ExpiresAt = DateTime.UtcNow.AddDays(7),
                CreatedAt = DateTime.UtcNow
            };

            await authTokenRepository.AddAsync(authToken, cancellationToken);

            return new AuthenticationResponseDto
            {
                AccessToken = accessToken,

                RefreshToken = refreshToken
            };

        }
    }
}
