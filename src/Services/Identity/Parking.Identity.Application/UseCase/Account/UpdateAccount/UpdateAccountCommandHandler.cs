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

            if (!string.IsNullOrWhiteSpace(request.EmailNormalized))
            {
                var email = request.EmailNormalized.Trim().ToUpperInvariant();
                if (account.EmailNormalized != email)
                {
                    var existingEmail = await repository.GetUserByEmail(email);
                    if (existingEmail != null && existingEmail.Id != account.Id)
                    {
                        throw new AppException(ErrorCode.EmailAlreadyExists, "An account with this email address already exists.");
                    }
                    account.EmailNormalized = email;
                    account.EmailVerifiedAt = null;
                }
            }

            if (request.PhoneE164 != null)
            {
                var phoneE164 = request.PhoneE164.Trim();
                if (account.PhoneE164 != phoneE164)
                {
                    if (!string.IsNullOrWhiteSpace(phoneE164))
                    {
                        var existingPhone = await repository.GetUserByPhone(phoneE164);
                        if (existingPhone != null && existingPhone.Id != account.Id)
                        {
                            throw new AppException(ErrorCode.PhoneAlreadyExists, "An account with this phone number already exists.");
                        }
                    }
                    account.PhoneE164 = string.IsNullOrWhiteSpace(phoneE164) ? null : phoneE164;
                    account.PhoneVerifiedAt = null;
                }
            }

            if (!string.IsNullOrWhiteSpace(request.FullName))
            {
                account.FullName = request.FullName.Trim();
            }

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
                EmailVerifiedAt = account.EmailVerifiedAt,
                PhoneVerifiedAt = account.PhoneVerifiedAt,
                LockedUntil = account.LockedUntil,
                CreatedAt = account.CreatedAt,
                UpdatedAt = account.UpdatedAt,
                Roles = account.PlatformUserRoles.Select(r => r.RoleCode).ToList()
            };
        }
    }
}
