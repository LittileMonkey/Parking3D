using MediatR;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Template.Application.Dto;

namespace Template.Application.UseCase.UpdateAccount
{
    public record UpdateAccountCommand : IRequest<AccountDto>
    {
        public string? MemberId { get; init; }
        public string FullName { get; init; } = string.Empty;
        public string EmailAddress { get; init; } = string.Empty;
        public DateOnly? Dob { get; init; }
        public string MemberPassword { get; init; } = string.Empty;
    }
}
