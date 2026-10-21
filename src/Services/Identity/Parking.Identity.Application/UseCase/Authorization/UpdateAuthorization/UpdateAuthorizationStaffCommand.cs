using MediatR;
using Parking.Identity.Application.DTOs;

namespace Parking.Identity.Application.UseCase.Authorization.UpdateAuthorization
{
    public record UpdateAuthorizationStaffCommand : IRequest<AppUserDto>
    {
        public Guid userId { get; set; }
        public string RoleCode { get; set; }
    }
}
