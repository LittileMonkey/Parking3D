using MediatR;
using Parking.Identity.Application.Common.AppException;
using Parking.Identity.Application.Common.Constants;
using Parking.Identity.Application.Common.Enum;
using Parking.Identity.Application.Common.Interface;
using Microsoft.Extensions.Caching.Memory;

namespace Parking.Identity.Application.UseCase.Authentication.ResetPassword
{
    public class ResetPasswordCommandHandler : IRequestHandler<ResetPasswordCommand, bool>
    {
        private readonly IOtpService otpService;
        private readonly IAccountRepository accountRepository;
        private readonly IPasswordResetOtpRepository passwordResetOtpRepository;
        private readonly IUnitOfWork unit;
        private readonly IPasswordHasherService passwordHasherService;
        private readonly IAuthTokenRepository authTokenRepository;
        private readonly IMemoryCache memory;

        private const int MaxAttempts = 5;

        public ResetPasswordCommandHandler(
            IMemoryCache memory,
            IAuthTokenRepository authTokenRepository,
            IPasswordHasherService passwordHasherService,
            IOtpService otpService,
            IAccountRepository accountRepository,
            IPasswordResetOtpRepository passwordResetOtpRepository,
            IUnitOfWork unit)
        {
            this.otpService = otpService;
            this.accountRepository = accountRepository;
            this.passwordResetOtpRepository = passwordResetOtpRepository;
            this.unit = unit;
            this.passwordHasherService = passwordHasherService;
            this.authTokenRepository = authTokenRepository;
            this.memory = memory;
        }

        public async Task<bool> Handle(ResetPasswordCommand request, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(request.Email) ||
                string.IsNullOrWhiteSpace(request.Otp) ||
                string.IsNullOrWhiteSpace(request.NewPassword))
            {
                throw new AppException(ErrorCode.InvalidRequest, "Email, OTP and new password are required.");
            }

            var emailNormalized = request.Email.Trim().ToUpperInvariant();

            var user = await accountRepository.GetUserByEmail(emailNormalized);
            if (user is null)
            {
                throw new AppException(ErrorCode.AccountNotFound, "The requested account could not be found.");
            }

            if (user.Status != AppUserStatus.Active)
            {
                throw new AppException(ErrorCode.AccountInactive, "The account is currently inactive.");
            }

            if (user.LockedUntil.HasValue && user.LockedUntil.Value > DateTime.UtcNow)
            {
                throw new AppException(ErrorCode.AccountLocked, "The account is temporarily locked. Please try again later.");
            }

            var otpEntity = await passwordResetOtpRepository.GetLatestUnusedOtpAsync(user.Id, cancellationToken);
            if (otpEntity is null)
            {
                throw new AppException(ErrorCode.OtpNotFound, "No active verification code was found for this account.");
            }

            if (otpEntity.ExpiresAt <= DateTimeOffset.UtcNow)
            {
                throw new AppException(ErrorCode.OtpExpired, "The verification code has expired. Please request a new code.");
            }

            var cacheKey = $"reset-password-otp-attempts:{user.Id}:{otpEntity.Id}";

            if ((memory.TryGetValue(cacheKey, out int cachedAttempts) && cachedAttempts >= MaxAttempts) ||
                otpEntity.AttemptCount >= MaxAttempts)
            {
                throw new AppException(ErrorCode.OtpMaxAttemptsExceeded, "Maximum verification attempts exceeded. Please request a new code.");
            }

            var isOtpValid = otpService.VerifyOtp(request.Otp.Trim(), otpEntity.OtpHash);

            if (!isOtpValid)
            {
                otpEntity.AttemptCount++;
                cachedAttempts++;

                memory.Set(cacheKey, cachedAttempts, new MemoryCacheEntryOptions
                {
                    AbsoluteExpiration = otpEntity.ExpiresAt
                });

                if (otpEntity.AttemptCount >= MaxAttempts)
                {
                    otpEntity.UsedAt = DateTimeOffset.UtcNow;
                    await unit.SaveChangesAsync(cancellationToken);
                    throw new AppException(ErrorCode.OtpMaxAttemptsExceeded, "Maximum verification attempts exceeded. Please request a new code.");
                }

                await unit.SaveChangesAsync(cancellationToken);

                var remainingAttempts = MaxAttempts - otpEntity.AttemptCount;
                throw new AppException(ErrorCode.OtpInvalid, $"The verification code is incorrect. You have {remainingAttempts} attempt(s) remaining.");
            }

            using var transaction = await unit.BeginTransactionAsync(cancellationToken);
            try
            {
                var newPasswordHash = passwordHasherService.HashPassword(user, request.NewPassword);

                user.PasswordHash = newPasswordHash;
                user.UpdatedAt = DateTime.UtcNow;

                otpEntity.UsedAt = DateTimeOffset.UtcNow;

                await accountRepository.UpdateAccount(user);
                await authTokenRepository.RevokedAllByUserIdAsync(user.Id, cancellationToken);
                await unit.SaveChangesAsync(cancellationToken);

                await transaction.CommitAsync(cancellationToken);

                memory.Remove(cacheKey);

                return true;
            }
            catch (Exception)
            {
                await transaction.RollbackAsync(cancellationToken);
                throw;
            }
        }
    }
}
