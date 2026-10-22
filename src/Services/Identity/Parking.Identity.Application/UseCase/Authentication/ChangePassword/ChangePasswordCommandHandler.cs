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
        public ChangePasswordCommandHandler(IAccountRepository repository, IPasswordHasherService service)
        {
            this.accountRepository = repository;
            this.passwordHasherService = service;
        }

        public async Task<bool> Handle(ChangePasswordCommand request, CancellationToken cancellationToken)
        {
            ArgumentNullException.ThrowIfNullOrEmpty(request.NewPassword);

            var user = await accountRepository.GetUserByIdAsync(request.Id, cancellationToken);

            if(user == null)
            {
                throw new AppException(ErrorCode.AccountNotFound, "Account Not Found");
            }

            if(!passwordHasherService.VerifiedPassword(user, request.Password, user.PasswordHash))
            {
                throw new AppException(ErrorCode.PasswordIncorrect, "Password Incorrect!!!");
            }

            

            if(passwordHasherService.VerifiedPassword(user, request.NewPassword, user.PasswordHash))
            {
                throw new AppException(ErrorCode.PasswordIncorrect,"New password must be different from current password");
            }

            if (request.NewPassword != request.ConfirmPassword)
            {
                throw new AppException(
                    ErrorCode.PasswordIncorrect,
                    "New password and confirm password do not match");
            }

            var newPassHash = passwordHasherService.HashPassword(user, request.NewPassword);

            user.PasswordHash = newPassHash;

            await accountRepository.UpdateAccount(user);

            return true;

        }
    }
}
