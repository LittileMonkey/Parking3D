namespace Parking.Identity.Application.Common.Interface
{
    public interface IEmailService
    {
        Task SendSignInOtpAsync(string email, string otp, CancellationToken cancellationToken);
        Task SendPasswordResetOtpAsync(string email, string otp, CancellationToken cancellationToken);
    }
}
