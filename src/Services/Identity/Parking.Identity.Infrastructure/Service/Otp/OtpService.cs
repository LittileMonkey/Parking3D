using Microsoft.Extensions.Configuration;
using Parking.Identity.Application.Common.Interface;
using System.Security.Cryptography;
using System.Text;

namespace Parking.Identity.Infrastructure.Service.Otp
{
    public class OtpService : IOtpService
    {
        private readonly byte[] _secret;
        public OtpService(IConfiguration configuration)
        {
            var secret = configuration["PasswordReset:OtpSecret"];

            if (string.IsNullOrWhiteSpace(secret))
            {
                throw new InvalidOperationException("PasswordReset:OtpSecret is not configured.");
            }

            _secret = Encoding.UTF8.GetBytes(secret);
        }
        public string GenerateOtp()
        {
            return RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");
        }

        public string HashOtp(string otp)
        {
            var otpHash = HMACSHA256.HashData(_secret, Encoding.UTF8.GetBytes(otp));

            return Convert.ToHexString(otpHash);
        }

        public bool VerifyOtp(string otp, string otpHash)
        {
            var actualHash = HashOtp(otp);
            try
            {
                return CryptographicOperations
                    .FixedTimeEquals(
                    Convert.FromHexString(actualHash),
                    Convert.FromHexString(otpHash));
            }
            catch (FormatException)
            {
                return false;
            }
        }
    }
}
