using Parking.Identity.Application.DTOs;
using MediatR;

namespace Parking.Identity.Application.UseCase.Account.GetAccountByEmail
{
    public record GetAccountByEmailQuery : IRequest<AppUserDto>
    {
        public string emailNormalized { get; set; } = string.Empty;
    }
}
