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
using Template.Domain.Entities;

namespace Template.Application.UseCase.Account
{
    public class CreateAccountCommandHandler : IRequestHandler<CreateAccountCommand, AccountDto>
    {
        private readonly IAccountRepository repository;
        private readonly IUnitOfWork unitOfWork;

        public CreateAccountCommandHandler(IAccountRepository repository, IUnitOfWork unitOfWork)
        {
            this.repository = repository;
            this.unitOfWork = unitOfWork;
        }

        public async Task<AccountDto> Handle(CreateAccountCommand request, CancellationToken cancellationToken)
        {
            var existingAccount = await repository.GetAccountByEmailAsync(request.EmailAddress);

            if (existingAccount != null)
            {
                throw new AppException((int)ErrorCode.EmailAlreadyExists, "An account with this email address already exists.", 400);
            }
            // Continue with account creation logic

            var account = new AccountMember
            {
                MemberId = Guid.NewGuid().ToString(),
                FullName = request.FullName,
                EmailAddress = request.EmailAddress,
                MemberPassword = request.MemberPassword,
                Dob = request.Dob,
                MemberRole = string.IsNullOrWhiteSpace(request.MemberRole) ? "Member" : request.MemberRole,
                Status = string.IsNullOrWhiteSpace(request.Status) ? "Active" : request.Status
            };

           

            await repository.CreateAccountAsync(account);
            await unitOfWork.SaveChangesAsync(cancellationToken);

            return new AccountDto
            {
                MemberId = account.MemberId,
                FullName = account.FullName,
                EmailAddress = account.EmailAddress,
                MemberRole = account.MemberRole,
                Dob = account.Dob
            };
        }
       
    }
}
