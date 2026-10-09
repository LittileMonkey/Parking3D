    using System;
    using System.Collections.Generic;
    using System.Linq;
    using System.Text;
    using System.Threading.Tasks;
    using MediatR;
    using Template.Application.Dto;

    namespace Template.Application.UseCase.Account
    {
        public record CreateAccountCommand : IRequest<AccountDto>
        {
            public string FullName { get; init; } = string.Empty;
            public string EmailAddress { get; init; } = string.Empty;
            public DateOnly? Dob { get; init; }
            public string MemberRole { get; init; } = string.Empty;
            public string? Status { get; init; } = string.Empty;
            public string MemberPassword { get; init; } = string.Empty;
        }
    }
