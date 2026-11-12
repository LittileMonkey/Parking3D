using Parking.Identity.Application.DTOs;
using MediatR;

namespace Parking.Identity.Application.UseCase.Authentication.Login
{
    public record LoginCommand : IRequest<AuthenticationResponseDto>
    {
        public string? emailNormalized { get; set; }
        public string? password { get; set; }
    }
}
