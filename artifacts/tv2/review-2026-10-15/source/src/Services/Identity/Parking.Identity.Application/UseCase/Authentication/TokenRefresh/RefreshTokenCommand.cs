using Parking.Identity.Application.DTOs;
using MediatR;

namespace Parking.Identity.Application.UseCase.Authentication.TokenRefresh
{
    public record RefreshTokenCommand : IRequest<AuthenticationResponseDto>
    {
        public string refreshToken { get; set; } = string.Empty;
    }
}
