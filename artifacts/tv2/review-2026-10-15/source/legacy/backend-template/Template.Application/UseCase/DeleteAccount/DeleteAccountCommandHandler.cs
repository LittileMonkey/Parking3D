using MediatR;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Template.Application.Common.Enum;
using Template.Application.Common.Exception;
using Template.Application.Common.Interface;

namespace Template.Application.UseCase.DeleteAccount
{
    public class DeleteAccountCommandHandler : IRequestHandler<DeleteAccountCommand , Unit>
    {
        private readonly IAccountRepository repository;
        private readonly IUnitOfWork unitOfWork;
        public DeleteAccountCommandHandler(IAccountRepository repository, IUnitOfWork unitOfWork)
        {
            this.repository = repository;
            this.unitOfWork = unitOfWork;
        }
        public async Task<Unit> Handle(DeleteAccountCommand request, CancellationToken cancellationToken)
        {
            var acountId  = await repository.GetAccountByIdAsync(request.MemberId);

            if(acountId == null)
            {
                throw new AppException((int)ErrorCode.AccountNotFound, "Account not found.", 404);
            }

            await repository.DeleteAccountAsync(acountId);
            await unitOfWork.SaveChangesAsync(cancellationToken);
            return Unit.Value;
        }
    }
}
