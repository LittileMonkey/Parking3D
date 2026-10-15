using Parking.Identity.Application.Common.Constants;
using Parking.Identity.Application.Common.Interface;
using Parking.Identity.Domain.Entities;
using Microsoft.Extensions.Configuration;

namespace Parking.Identity.Infrastructure.Initializer
{
    public class DbInitializer
    {
        private readonly IAccountRepository accountRepository;
        private readonly IPasswordHasherService passwordHasher;
        private readonly IUnitOfWork unitOfWork;
        private readonly IConfiguration configuration;
        public DbInitializer(IAccountRepository accountRepository, IPasswordHasherService passwordHasher, IUnitOfWork unitOfWork, IConfiguration configuration)
        {
            this.accountRepository = accountRepository;
            this.passwordHasher = passwordHasher;
            this.unitOfWork = unitOfWork;
            this.configuration = configuration;
        }

        public async Task SeedAdminAsync(CancellationToken cancellationToken = default)
        {
            var seedAdmin = configuration.GetSection("SeedAdmin");

            var email = seedAdmin["Email"];

            var password = seedAdmin["Password"];

            var fullName = seedAdmin["FullName"];

            if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password) || string.IsNullOrWhiteSpace(fullName))
            {
                throw new InvalidOperationException("Chưa cấu hình thông tin tài khoản Admin.");
            }
            var existingEmail = await accountRepository.GetUserByEmail(email);

            if (existingEmail != null)
            {
                return;
            }


            var userId = Guid.NewGuid();
            var appUserAdmin = new AppUser
            {
                Id = userId,
                FullName = fullName,
                EmailNormalized = email,
                PhoneE164 = "+84383900873",
                Status = "Active",
                CreatedAt = DateTime.UtcNow,
                PlatformUserRoles = new List<PlatformUserRole>
                {
                    new PlatformUserRole
                    {
                        UserId = userId,
                        RoleCode = AppUserRoles.Admin
                    }
                },
            };

            appUserAdmin.PasswordHash = passwordHasher.HashPassword(appUserAdmin, password);

            await accountRepository.Register(appUserAdmin);
            await unitOfWork.SaveChangesAsync(cancellationToken);

        }

    }
}
