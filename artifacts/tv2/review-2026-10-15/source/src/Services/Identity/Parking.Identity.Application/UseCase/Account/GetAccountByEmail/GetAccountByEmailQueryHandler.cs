using Parking.Identity.Application.Common.AppException;
using Parking.Identity.Application.Common.Enum;
using Parking.Identity.Application.Common.Interface;
using Parking.Identity.Application.DTOs;
using MediatR;

namespace Parking.Identity.Application.UseCase.Account.GetAccountByEmail
{
    public class GetAccountByEmailQueryHandler : IRequestHandler<GetAccountByEmailQuery, AppUserDto>
    {
        private readonly IAccountRepository repository;
        public GetAccountByEmailQueryHandler(IAccountRepository _repository)
        {
            this.repository = _repository;
        }
        public async Task<AppUserDto> Handle(GetAccountByEmailQuery request, CancellationToken cancellationToken)
        {
            var existingEmail = await repository.GetUserByEmail(request.emailNormalized);

            if (existingEmail == null)
            {
                throw new AppException(ErrorCode.EmailNotFound, "Email Not Found");
            }

            return new AppUserDto
            {
                Id = existingEmail.Id,

                FullName = existingEmail.FullName,

                EmailNormalized = existingEmail.EmailNormalized,

                PhoneE164 = existingEmail.PhoneE164,

                Status = existingEmail.Status,

                CreatedAt = existingEmail.CreatedAt,

                UpdatedAt = existingEmail.UpdatedAt
            };
        }
    }
}
