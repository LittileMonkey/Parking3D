using MediatR;
using Parking.Identity.Application.Common.AppException;
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
        public ResetPasswordCommandHandler(IMemoryCache memory ,IAuthTokenRepository authTokenRepository, IPasswordHasherService passwordHasherService, IOtpService otpService, IAccountRepository accountRepository, IPasswordResetOtpRepository passwordResetOtpRepository, IUnitOfWork unit)
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
            var emailNormalized = request.Email.Trim().ToUpperInvariant();

            var user = await accountRepository.GetUserByEmail(emailNormalized);

            if(user is null)
            {
                throw new AppException(ErrorCode.AccountNotFound, "Account Not Found");
                
            }

            var otpEntity = await passwordResetOtpRepository.GetLatestUnusedOtpAsync(user.Id, cancellationToken);

            if(otpEntity is null)
            {
                throw new AppException(ErrorCode.OtpNotFound, "Otp Not Found");
            }

            if(otpEntity.ExpiresAt <= DateTimeOffset.UtcNow)
            {
                throw new AppException(ErrorCode.Unauthorized, "OTP has expired, Please request send a new OTP ");
            }

            var cacheKey = $"reset-password-otp-attempts:{user.Id}:{otpEntity.Id}";

            if(memory.TryGetValue(cacheKey, out int attemptCount) && attemptCount >= MaxAttempts)
            {
                throw new AppException(ErrorCode.Unauthorized, "Maximum OTP attempts exceeded, Please request system sent new OTP to you!!!.");
            }

            var isOtpValid = otpService.VerifyOtp(request.Otp, otpEntity.OtpHash);

            if (!isOtpValid)
            {
                attemptCount = memory.Get<int>(cacheKey);

                attemptCount++;

                memory.Set(cacheKey, attemptCount, new MemoryCacheEntryOptions
                {
                    AbsoluteExpiration = otpEntity.ExpiresAt
                });

                var remainingAttempts = MaxAttempts - attemptCount;

                if(remainingAttempts <= 0)
                {
                    throw new AppException(ErrorCode.Unauthorized, "Maximum OTP attempt exceed, Please request a new OTP");
                }


                throw new AppException(ErrorCode.Unauthorized, $"Invalid OTO, You have {remainingAttempts} attempt(s) remaining");
            }

            using var transaction = await unit.BeginTransactionAsync(cancellationToken);
            try
            {
                var newPasswordHash = passwordHasherService.HashPassword(user, request.NewPassword);

                user.PasswordHash = newPasswordHash;

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
