using MediatR;

namespace Parking.Identity.Application.UseCase.Authentication.ResetPassword
{
    public record ResetPasswordCommand : IRequest<bool>
    {
        public string Email { get; set; } = string.Empty;
        public string Otp { get; set; } = string.Empty;
        public string NewPassword { get; set; }

    }
}
