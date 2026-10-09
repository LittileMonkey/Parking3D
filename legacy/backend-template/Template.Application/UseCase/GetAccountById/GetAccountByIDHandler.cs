using MediatR;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Template.Application.Common.Enum;
using Template.Application.Common.Exception;
using Template.Application.Common.Interface;
using Template.Application.Dto;

namespace Template.Application.UseCase.GetAccountById
{
    public class GetAccountByIDHandler : IRequestHandler<GetAccountByIdQuery, AccountDto>
    {
        public readonly IAccountRepository repository;
        public readonly IUnitOfWork unitOfWork;

        public GetAccountByIDHandler(IAccountRepository repository, IUnitOfWork unitOfWork)
        {
            this.repository = repository;
            this.unitOfWork = unitOfWork;
        }
        public async Task<AccountDto> Handle(GetAccountByIdQuery request, CancellationToken cancellationToken)
        {
            var accountId = await repository.GetAccountByIdAsync(request.memberId);

            if(accountId == null)
            {
                throw new AppException((int)ErrorCode.AccountNotFound, "Account not found.", 404);
            }

            return new AccountDto
            {
                MemberId = accountId.MemberId,
                MemberPassword = accountId.MemberPassword,
                FullName = accountId.FullName,
                EmailAddress = accountId.EmailAddress,
                MemberRole = accountId.MemberRole,
                Dob = accountId.Dob
            };
        }
    }
}
