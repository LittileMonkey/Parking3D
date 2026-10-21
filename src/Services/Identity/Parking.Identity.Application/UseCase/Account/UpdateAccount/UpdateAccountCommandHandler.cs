using Parking.Identity.Application.Common.AppException;
using Parking.Identity.Application.Common.Enum;
using Parking.Identity.Application.Common.Interface;
using Parking.Identity.Application.DTOs;
using MediatR;

namespace Parking.Identity.Application.UseCase.Account.UpdateAccount
{
    public class UpdateAccountCommandHandler : IRequestHandler<UpdateAccountCommand, AppUserDto>
    {
        private readonly IAccountRepository repository;
        private readonly IUnitOfWork unitOfWork;
        private readonly IPasswordHasherService passwordHasher;
        public UpdateAccountCommandHandler(IAccountRepository repository, IUnitOfWork unitOfWork, IPasswordHasherService passwordHasher)
        {
            this.repository = repository;
            this.unitOfWork = unitOfWork;
            this.passwordHasher = passwordHasher;
        }
        public async Task<AppUserDto> Handle(UpdateAccountCommand request, CancellationToken cancellationToken)
        {
            var account = await repository.GetUserByIdAsync(request.Id, cancellationToken);

            if (account == null)
            {
                throw new AppException(ErrorCode.AccountNotFound, "The requested account could not be found.");
            }
            var email = request.EmailNormalized.Trim().ToUpperInvariant();

            if (account.EmailNormalized != email)
            {
                var existingEmail = await repository.GetUserByEmail(email);

                if (existingEmail != null && existingEmail.Id != account.Id)
                {
                    throw new AppException(ErrorCode.EmailAlreadyExists, "An account with this email address already exists.");
                }


                account.EmailNormalized = email;
            }

            account.FullName = request.FullName;
            account.PhoneE164 = request.PhoneE164;
            account.UpdatedAt = DateTime.UtcNow;

            await repository.UpdateAccount(account);
            await unitOfWork.SaveChangesAsync(cancellationToken);

            return new AppUserDto
            {
                Id = account.Id,
                FullName = account.FullName,
                EmailNormalized = account.EmailNormalized,
                PhoneE164 = account.PhoneE164,
                Status = account.Status,
                CreatedAt = account.CreatedAt,
                UpdatedAt = account.UpdatedAt
            };
        }
    }
}
