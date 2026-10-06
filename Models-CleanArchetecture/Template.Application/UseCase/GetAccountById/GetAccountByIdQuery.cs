using MediatR;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Template.Application.Dto;

namespace Template.Application.UseCase.GetAccountById
{
    public record GetAccountByIdQuery : IRequest<AccountDto?>
    {
        public string memberId { get; set; } = null!;
    }
}
