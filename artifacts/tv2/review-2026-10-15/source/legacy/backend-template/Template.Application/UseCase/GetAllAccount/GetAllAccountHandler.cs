using MediatR;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Template.Application.Common.Interface;
using Template.Application.Dto;

namespace Template.Application.UseCase.GetAllAccount
{
    public class GetAllAccountHandler : IRequestHandler<GetAllAccountQuery, List<AccountDto>>
    {
        public readonly IAccountRepository repository;
        public GetAllAccountHandler(IAccountRepository repository)
        {
            this.repository = repository;
        }
        public async Task<List<AccountDto>> Handle(GetAllAccountQuery request, CancellationToken cancellationToken)
        {
            var accounts = await repository.ListAccountsAsync();

            return accounts.Select(account => new AccountDto
            {
                MemberId = account.MemberId,
                FullName = account.FullName,
                EmailAddress = account.EmailAddress,
                MemberRole = account.MemberRole,
                Status = account.Status,
                Dob = account.Dob
            }).ToList();  
        }
    }
}
