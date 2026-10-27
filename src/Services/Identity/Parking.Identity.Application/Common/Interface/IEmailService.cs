namespace Parking.Identity.Application.Common.Interface
{
    public interface IEmailService
    {
        Task SendPasswordResetOtpAsync(string email, string otp, CancellationToken cancellationToken);
    }
}
