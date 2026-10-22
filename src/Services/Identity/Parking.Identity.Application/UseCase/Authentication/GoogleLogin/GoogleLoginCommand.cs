using MediatR;

namespace Parking.Identity.Application.UseCase.Authentication.GoogleLogin
{
    public sealed record GoogleLoginCommand : IRequest<GoogleLoginResult>
    {
        public string IdToken { get; init; } = string.Empty;
    }
}
