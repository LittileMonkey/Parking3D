
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
        public readonly IAccountRepository repository;
        private readonly IUnitOfWork unitOfWork;
        private readonly IPasswordHasherService passwordHasher;

        public CreateAccountCommandHandler(IAccountRepository repository, IUnitOfWork unitOfWork, IPasswordHasherService passwordHasher)
        {
            this.repository = repository;
            this.unitOfWork = unitOfWork;
            this.passwordHasher = passwordHasher;
        }
        public async Task<AppUserDto> Handle(CreateAccountCommand request, CancellationToken cancellationToken)
        {
            var existingEmail = await repository.GetUserByEmail(request.EmailNormalized);

            if(existingEmail != null)
            {
                throw new AppException(ErrorCode.EmailAlreadyExists, "Email AlreadyExits");
            }

            var existingPhone = await repository.GetUserByPhone(request.PhoneE164);

            if (existingPhone != null)
            {
                throw new AppException(ErrorCode.PhoneAlreadyExists, "Your phone already exit!!!");
            }

            //Validate role
            var roles = request.Roles
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .Select(x => x.Trim().ToUpperInvariant())
                .Distinct().ToList();

            if(roles.Count == 0)
            {
                roles.Add(AppUserRoles.Customer);
            }

            //Validate Not Match

            var invalidRoles = roles
                .Where(role => !AppUserRoles.All.Contains(role))
                .ToList();

            if (invalidRoles.Count > 0) 
            { 
                throw new AppException(ErrorCode.InvalidRequest ,$"Invalid role(s): {string.Join(", ", invalidRoles)}");
            }

            Guid userId = Guid.NewGuid();
            var appUser = new AppUser()
            {
                Id = userId,
                FullName = request.FullName,
                EmailNormalized = request.EmailNormalized,
                PhoneE164 = request.PhoneE164,
                Status = "Active",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            appUser.PasswordHash = passwordHasher.HashPassword(appUser, request.Password);
            var verifyTest = passwordHasher.VerifiedPassword( appUser, request.Password, appUser.PasswordHash);

            Console.WriteLine($"REGISTER VERIFY = {verifyTest}");

            foreach (var role in roles)
            {
                appUser.PlatformUserRoles.Add(new PlatformUserRole
                {
                    UserId = userId,
                    RoleCode = role
                });
            }

            await repository.Register(appUser);

            await unitOfWork.SaveChangesAsync(cancellationToken);

            return new AppUserDto
            {
                Id = appUser.Id,

                FullName = appUser.FullName,

                EmailNormalized = appUser.EmailNormalized,

                PhoneE164 = appUser.PhoneE164,

                Status = appUser.Status,

                Roles = roles,

                CreatedAt = appUser.CreatedAt,

            };

        }
    }
}
