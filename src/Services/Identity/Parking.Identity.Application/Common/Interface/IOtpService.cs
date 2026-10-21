namespace Parking.Identity.Application.Common.Interface
{
    public interface IOtpService
    {
        string GenerateOtp();
        string HashOtp(string otp);
        bool VerifyOtp(string otp, string otpHash);
    }
}
