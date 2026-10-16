using Parking.Identity.Application.DTOs;
using MediatR;
namespace Parking.Identity.Application.UseCase.Account.UpdateAccount
{
    public class UpdateAccountCommand : IRequest<AppUserDto>
    {
        public Guid Id { get; set; }
        public string FullName { get; set; } = null!;
        public string EmailNormalized { get; set; } = null!;
        public string? PhoneE164 { get; set; }
    }
}
