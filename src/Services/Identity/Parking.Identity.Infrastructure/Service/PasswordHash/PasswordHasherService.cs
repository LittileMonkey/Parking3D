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

            log.LogInformation("Generated password hash: {Hash}", hash);
            log.LogInformation("Generated hash length: {Length}", hash.Length);

            var result = passwordHasher.VerifyHashedPassword(appUser, hash, password);

            log.LogInformation("Self password verification result: {Result}", result);

            return hash;
        }

        public bool VerifiedPassword(AppUser appUser, string password, string passwordHash)
        {
            log.LogInformation("PASSWORD HASH = {Hash}", passwordHash);
            log.LogInformation("PASSWORD HASH LENGTH = {Length}", passwordHash?.Length);

            var result = passwordHasher.VerifyHashedPassword(appUser, passwordHash, password);

            log.LogInformation("VERIFY RESULT = {Result}", result);

            return result == PasswordVerificationResult.Success
                || result == PasswordVerificationResult.SuccessRehashNeeded;
        }
    }
}
