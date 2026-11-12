using Parking.Identity.Application.Common.AppException;
using Parking.Identity.Application.Common.Enum;
using Parking.Identity.Application.Common.Interface;
using Parking.Identity.Application.DTOs;
using MediatR;

namespace Parking.Identity.Application.UseCase.Account.GetAccountById
{
    public class GetAccountByIdQueryHandler : IRequestHandler<GetAccountByIdQuery, AppUserDto>
    {
        private readonly IAccountRepository repository;
        public GetAccountByIdQueryHandler(IAccountRepository _repository)
        {
            this.repository = _repository;
        }
        public async Task<AppUserDto> Handle(GetAccountByIdQuery request, CancellationToken cancellationToken)
        {
            var user = await repository.GetUserByIdAsync(request.Id, cancellationToken);
            if (user == null)
            {
                throw new AppException(ErrorCode.AccountNotFound, "Account Not Found");
            }

            return new AppUserDto
            {
                Id = user.Id,

                FullName = user.FullName,

                EmailNormalized = user.EmailNormalized,

                PhoneE164 = user.PhoneE164,

                Status = user.Status,

                CreatedAt = user.CreatedAt,

                UpdatedAt = user.UpdatedAt
            };
        }
    }
}
