using Parking.Identity.Application.Common.Interface;
using Parking.Identity.Domain.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging;


namespace Identity.Infrastructure.Service.PasswordHash
{
    public class PasswordHasherService : IPasswordHasherService
    {
        private readonly PasswordHasher<AppUser> passwordHasher = new PasswordHasher<AppUser>();
        private readonly ILogger<PasswordHasherService> log;
        public PasswordHasherService(PasswordHasher<AppUser> password, ILogger<PasswordHasherService> logger)
        {
            this.passwordHasher = password;
            this.log = logger;
        }
        public string HashPassword(AppUser appUser, string password)
        {
            var hash = passwordHasher.HashPassword(appUser, password);

            var result = passwordHasher.VerifyHashedPassword(appUser, hash, password);

            return hash;
        }

        public bool VerifiedPassword(AppUser appUser, string password, string passwordHash)
        {
            var result = passwordHasher.VerifyHashedPassword(appUser, passwordHash, password);

            return result == PasswordVerificationResult.Success
                || result == PasswordVerificationResult.SuccessRehashNeeded;
        }
    }
}
