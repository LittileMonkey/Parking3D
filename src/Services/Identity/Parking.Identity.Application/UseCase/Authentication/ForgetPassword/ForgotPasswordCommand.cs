using MediatR;

namespace Parking.Identity.Application.UseCase.Authentication.ForgetPassword
{
    public record ForgotPasswordCommand : IRequest<ForgotPasswordResult>
    {
        public string Email { get; init; } = string.Empty;
    }

    public sealed record ForgotPasswordResult(string Message);
}
