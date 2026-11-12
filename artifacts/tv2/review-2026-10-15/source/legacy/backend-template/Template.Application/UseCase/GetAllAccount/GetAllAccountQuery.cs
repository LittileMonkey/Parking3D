using MediatR;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Template.Application.Dto;

namespace Template.Application.UseCase.GetAllAccount
{
    public record GetAllAccountQuery : IRequest<List<AccountDto>>;
}
