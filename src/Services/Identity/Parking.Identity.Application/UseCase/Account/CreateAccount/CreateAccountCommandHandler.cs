
using Parking.Identity.Application.Common.AppException;
using Parking.Identity.Application.Common.Constants;
using Parking.Identity.Application.Common.Enum;
using Parking.Identity.Application.Common.Interface;
using Parking.Identity.Application.DTOs;
using Parking.Identity.Domain.Entities;
using MediatR;
namespace Parking.Identity.Application.UseCase.Account.CreateAccount
{
    public class CreateAccountCommandHandler : IRequestHandler<CreateAccountCommand, AppUserDto>
    {
        private readonly IAccountRepository repository;
        private readonly IUnitOfWork unitOfWork;
        private readonly IPasswordHasherService passwordHasher;
        private readonly IUserMembershipRepository userMembershipRepository;

        public CreateAccountCommandHandler(IAccountRepository repository, IUnitOfWork unitOfWork, IPasswordHasherService passwordHasher, IUserMembershipRepository userMembershipRepository)
        {
            this.repository = repository;
            this.unitOfWork = unitOfWork;
            this.passwordHasher = passwordHasher;
            this.userMembershipRepository = userMembershipRepository;
        }
        public async Task<AppUserDto> Handle(CreateAccountCommand request, CancellationToken cancellationToken)
        {
            ArgumentNullException.ThrowIfNull(request.EmailNormalized);
            ArgumentNullException.ThrowIfNull(request.PhoneE164);
            // Chuẩn hóa email
            var email = request.EmailNormalized.Trim().ToUpperInvariant();

            var existingEmail = await repository.GetUserByEmail(email);

            if(existingEmail != null)
            {
                throw new AppException(ErrorCode.EmailAlreadyExists, "An account with this email address already exists.");
            }

            var existingPhone = await repository.GetUserByPhone(request.PhoneE164.Trim());

            if (existingPhone != null)
            {
                throw new AppException(ErrorCode.PhoneAlreadyExists, "An account with this phone number already exists.");
            }

            if (request.Roles != null && request.Roles.Any(r => !string.IsNullOrWhiteSpace(r) && !string.Equals(r.Trim(), AppUserRoles.Customer, StringComparison.OrdinalIgnoreCase)))
            {
                throw new AppException(ErrorCode.InvalidRequest, "Public registration cannot assign administrative roles.");
            }

            Guid userId = Guid.NewGuid();
            var appUser = new AppUser()
            {
                Id = userId,
                FullName = request.FullName,
                EmailNormalized = email,
                PhoneE164 = request.PhoneE164,
                Status = AppUserStatus.Active,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            var memberShip = new UserMembership
            {
                UserId = appUser.Id,
                TierCode = UserMembershipTierCode.STANDARD
            };

             appUser.PasswordHash = passwordHasher.HashPassword(appUser, request.Password);

             appUser.PlatformUserRoles.Add(new PlatformUserRole
             {
                    UserId = userId,
                    RoleCode = AppUserRoles.Customer
             });

            await repository.Register(appUser);
            await userMembershipRepository.AddUserMembershipAsync(memberShip, cancellationToken);

            await unitOfWork.SaveChangesAsync(cancellationToken);

            return new AppUserDto
            {
                Id = appUser.Id,

                FullName = appUser.FullName,

                EmailNormalized = appUser.EmailNormalized,

                PhoneE164 = appUser.PhoneE164,

                Status = appUser.Status,

                Roles = new List<string>()
                {
                    AppUserRoles.Customer
                },

                CreatedAt = appUser.CreatedAt,

            };

        }
    }
}
