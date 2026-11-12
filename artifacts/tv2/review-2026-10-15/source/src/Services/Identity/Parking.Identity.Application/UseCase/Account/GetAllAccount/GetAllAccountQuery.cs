using Parking.Identity.Application.DTOs;
using MediatR;

namespace Parking.Identity.Application.UseCase.Account.GetAllAccount
{
    public record GetAllAccountQuery : IRequest<IEnumerable<AppUserDto>>;
}
