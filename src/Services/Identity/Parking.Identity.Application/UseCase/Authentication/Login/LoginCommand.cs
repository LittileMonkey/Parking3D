using Parking.Identity.Application.DTOs;
using MediatR;

namespace Parking.Identity.Application.UseCase.Authentication.Login
{
    public record LoginCommand : IRequest<AuthenticationResponseDto>
    {
        public string Email { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
    }
}
