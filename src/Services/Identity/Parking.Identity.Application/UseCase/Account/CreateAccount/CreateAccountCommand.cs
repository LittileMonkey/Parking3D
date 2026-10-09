using Parking.Identity.Application.DTOs;
using MediatR;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Identity.Application.UseCase.Account.CreateAccount
{
    public record CreateAccountCommand : IRequest<AppUserDto>
    {
        public string? EmailNormalized { get; set; }

        public string? PhoneE164 { get; set; }
        public string Password { get; set; } = null!;

        public string FullName { get; set; } = null!;

        public string Status { get; set; } = string.Empty;

        public List<string> Roles { get; set; } = new List<string>();
    }
}
