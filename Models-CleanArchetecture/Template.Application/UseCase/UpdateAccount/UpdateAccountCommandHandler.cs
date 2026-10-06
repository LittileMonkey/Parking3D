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

namespace Template.Application.UseCase.UpdateAccount
{
    public class UpdateAccountCommandHandler : IRequestHandler<UpdateAccountCommand, AccountDto>
    {
        private readonly IAccountRepository repository;
        private readonly IUnitOfWork unitOfWork;

        public UpdateAccountCommandHandler(IAccountRepository repository, IUnitOfWork unitOfWork)
        {
            this.repository = repository;
            this.unitOfWork = unitOfWork;
        }
        public async Task<AccountDto> Handle(UpdateAccountCommand request, CancellationToken cancellationToken)
        {
            var account = await repository.GetAccountByIdAsync(request.MemberId);

            if(account == null)
            {
                throw new AppException((int)ErrorCode.AccountNotFound, "Account not found.", 404 );
            }

            account.UpdateMember(request.FullName, request.EmailAddress, request.MemberPassword, request.Dob);

            await repository.UpdateAccountAsync(account);

            await unitOfWork.SaveChangesAsync(cancellationToken);

            return new AccountDto
            {
                MemberId = account.MemberId,
                FullName = account.FullName,
                EmailAddress = account.EmailAddress,
                Dob = account.Dob
            };
        }
    }
}
