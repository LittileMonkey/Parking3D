using MediatR;

namespace Parking.Identity.Application.UseCase.Authentication.GoogleLogin
{
    public sealed record GoogleLoginCommand : IRequest<GoogleLoginResult>
    {
        public string? MfaCode { get; init; }
        public string IdToken { get; init; } = string.Empty;
    }
}
