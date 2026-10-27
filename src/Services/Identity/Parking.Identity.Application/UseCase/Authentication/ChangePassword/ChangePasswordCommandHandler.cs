using MediatR;
using Parking.Identity.Application.Common.AppException;
using Parking.Identity.Application.Common.Enum;
using Parking.Identity.Application.Common.Interface;

namespace Parking.Identity.Application.UseCase.Authentication.ChangePassword
{
    public class ChangePasswordCommandHandler : IRequestHandler<ChangePasswordCommand, bool>
    {
        private readonly IAccountRepository accountRepository;
        private readonly IPasswordHasherService passwordHasherService;
        private readonly IAuthTokenRepository authTokenRepository;
        private readonly IUnitOfWork unitOfWork;
        public ChangePasswordCommandHandler(
            IAccountRepository repository,
            IPasswordHasherService service,
            IAuthTokenRepository authTokenRepository,
            IUnitOfWork unitOfWork)
        {
            this.accountRepository = repository;
            this.passwordHasherService = service;
            this.authTokenRepository = authTokenRepository;
            this.unitOfWork = unitOfWork;
        }

        public async Task<bool> Handle(ChangePasswordCommand request, CancellationToken cancellationToken)
        {
            ArgumentNullException.ThrowIfNull(request.Password);
            ArgumentNullException.ThrowIfNull(request.NewPassword);
            var user = await accountRepository.GetUserByIdAsync(request.Id, cancellationToken);

            if(user == null)
            {
                throw new AppException(ErrorCode.AccountNotFound, "The requested account could not be found.");
            }

            if(string.IsNullOrWhiteSpace(user.PasswordHash) || !passwordHasherService.VerifiedPassword(user, request.Password, user.PasswordHash))
            {
                throw new AppException(ErrorCode.PasswordIncorrect, "The current password entered is incorrect.");
            }

           
            if(passwordHasherService.VerifiedPassword(user, request.NewPassword, user.PasswordHash))
            {
                throw new AppException(ErrorCode.PasswordIncorrect, "The new password must be different from the current password.");
            }

            if (request.NewPassword != request.ConfirmPassword)
            {
                throw new AppException(
                    ErrorCode.PasswordIncorrect,
                    "The new password and confirmation password do not match.");
            }

            var newPassHash = passwordHasherService.HashPassword(user, request.NewPassword);

            user.PasswordHash = newPassHash;
            user.UpdatedAt = DateTime.UtcNow;

            await accountRepository.UpdateAccount(user);
            await authTokenRepository.RevokedAllByUserIdAsync(user.Id, cancellationToken);
            await unitOfWork.SaveChangesAsync(cancellationToken);

            return true;

        }
    }
}
