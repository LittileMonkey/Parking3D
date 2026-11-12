using Parking.Identity.Application.DTOs;
using MediatR;


namespace Parking.Identity.Application.UseCase.Account.GetAccountById
{
    public record GetAccountByIdQuery : IRequest<AppUserDto>
    {
        public Guid Id { get; set; }
    }
}
