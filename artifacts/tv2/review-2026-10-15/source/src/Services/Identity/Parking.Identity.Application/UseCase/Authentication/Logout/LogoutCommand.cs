using MediatR;

namespace Parking.Identity.Application.UseCase.Authentication.Logout
{
    public record LogoutCommand : IRequest
    {
        public string? RefreshToken { get; set; }
    }
}
