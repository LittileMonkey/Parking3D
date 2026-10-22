using MediatR;
using Parking.Identity.Application.DTOs;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Identity.Application.UseCase.Authorization.UpdateAuthorization
{
    public record UpdateAuthorizationStaffCommand : IRequest<AppUserDto>
    {
        public Guid userId { get; set; }
        public string RoleCode { get; set; }
    }
}
