using MediatR;
using Parking.Identity.Application.Common.AppException;
using Parking.Identity.Application.Common.Constants;
using Parking.Identity.Application.Common.Enum;
using Parking.Identity.Application.Common.Interface;
using Parking.Identity.Domain.Entities;

namespace Parking.Identity.Application.UseCase.Authentication.GoogleLogin
{
    public class GoogleLoginCommandHandler : IRequestHandler<GoogleLoginCommand, GoogleLoginResult>
    {
        private readonly IAccountRepository repository;
        private readonly IGoogleSubjectLogin googleSubjectLogin;
        private readonly IAccessTokenService accessTokenService;
        private readonly IGoogleTokenValidator googleTokenValidator;
        private readonly IAuthTokenRepository authTokenRepository;
        private readonly IUnitOfWork unitOfWork;

        public GoogleLoginCommandHandler(IAccountRepository repository,
            IGoogleSubjectLogin googleSubjectLogin,
            IAccessTokenService accessTokenService,
            IGoogleTokenValidator googleTokenValidator,
            IAuthTokenRepository authTokenRepository,
            IUnitOfWork unitOfWork)
        {
            this.repository = repository;
            this.googleSubjectLogin = googleSubjectLogin;
            this.accessTokenService = accessTokenService;
            this.googleTokenValidator = googleTokenValidator;
            this.unitOfWork = unitOfWork;
            this.authTokenRepository = authTokenRepository;
        }
        public async Task<GoogleLoginResult> Handle(GoogleLoginCommand request, CancellationToken cancellationToken)
        {
            var googleUserInfo = await googleTokenValidator.ValidateAsync(request.IdToken, cancellationToken);

            if (!googleUserInfo.EmailVerified)
            {
                throw new UnauthorizedAccessException("Google email is not verified.");
            }
            var normalizedEmail = googleUserInfo.Email.ToUpperInvariant();

            var user = await googleSubjectLogin.GetByGoogleSubject(googleUserInfo.GoogleSubject, cancellationToken);

            if (user == null)
            {
                user = await repository.GetUserByEmail(normalizedEmail);

                if (user != null)
                {
                    throw new AppException(ErrorCode.EmailAlreadyExists, "An account with this email address already exists. Please sign in with your password.");
                }
                else
                {
                    var userId = Guid.NewGuid();
                    user = new AppUser
                    {
                        Id = userId,
                        EmailNormalized = normalizedEmail,
                        FullName = googleUserInfo.FullName ?? "Google User",
                        GoogleSubject = googleUserInfo.GoogleSubject,
                        EmailVerifiedAt = DateTime.UtcNow,
                        Status = AppUserStatus.Active,
                        PasswordHash = null,
                        PlatformUserRoles = new List<PlatformUserRole>
                        {
                            new PlatformUserRole
                            {
                                UserId = userId,
                                RoleCode = AppUserRoles.Customer
                            }
                        }
                    };

                    await repository.Register(user);

                }
            }

            if (user.Status == AppUserStatus.Deactivate)
            {
                throw new AppException(ErrorCode.AccountInactive, "The account has been deactivated.");
            }

            if (user.LockedUntil.HasValue && user.LockedUntil.Value > DateTime.UtcNow)
            {
                throw new AppException(ErrorCode.AccountLocked, "The account is temporarily locked. Please try again later.");
            }

            var accessToken = accessTokenService.GenerateAccessToken(user);

            var refreshToken = accessTokenService.GenerateRefreshToken();

            var refreshTokenHash = accessTokenService.HashToken(refreshToken);

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

            await unitOfWork.SaveChangesAsync(cancellationToken);

            return new GoogleLoginResult
            (
                 AccessToken: accessToken,
                 RefreshToken: refreshToken
            );

        }
    }
}
