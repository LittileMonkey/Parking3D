using MediatR;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Template.Application.UseCase.DeleteAccount
{
    public record DeleteAccountCommand() : IRequest<Unit>
    {
        public string? MemberId { get; init; }
    }
}
