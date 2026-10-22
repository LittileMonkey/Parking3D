using MediatR;
using Parking.Identity.Application.Common.Interface;
using Parking.Identity.Domain.Entities;

namespace Parking.Identity.Application.UseCase.Authentication.ForgetPassword
{
    public class ForgotPasswordCommandHandler : IRequestHandler<ForgotPasswordCommand, ForgotPasswordResult>
    {
        private readonly IOtpService otpService;
        private readonly IEmailService emailService;
        private readonly IAccountRepository accountRepository;
        private readonly IPasswordResetOtpRepository passwordResetOtpRepository;
        private readonly IUnitOfWork unit;

        public ForgotPasswordCommandHandler(IOtpService otpService, IEmailService emailService, IAccountRepository accountRepository, IPasswordResetOtpRepository passwordResetOtpRepository, IUnitOfWork unit)
        {
            this.otpService = otpService;
            this.emailService = emailService;
            this.accountRepository = accountRepository;
            this.passwordResetOtpRepository = passwordResetOtpRepository;
            this.unit = unit;
        }
        public async Task<ForgotPasswordResult> Handle(ForgotPasswordCommand request, CancellationToken cancellationToken)
        {
            var email = request.Email.Trim().ToUpperInvariant();

            var user = await accountRepository.GetUserByEmail(email);

            if (user is null)
            {
                return new ForgotPasswordResult("If the account exists, the OTP will be sent");
            }

            var otp = otpService.GenerateOtp();
            var now = DateTimeOffset.UtcNow;

            await passwordResetOtpRepository.InvalidateActiveOtpsAsync(user.Id, cancellationToken);

            var otpEntity = new PasswordResetOtp
            {
                Id = Guid.NewGuid(),
                UserId = user.Id,
                OtpHash = otpService.HashOtp(otp),
                CreatedAt = now,
                ExpiresAt = now.AddMinutes(5),
                UsedAt = null,
                AttemptCount = 0
            };

            await passwordResetOtpRepository.AddNewOtpAsync(otpEntity, cancellationToken);


            await unit.SaveChangesAsync(cancellationToken);


            await emailService.SendPasswordResetOtpAsync(user.EmailNormalized!, otp, cancellationToken);


            return new ForgotPasswordResult("If the account exists, the OTP will be sent");
        }
    }
}
