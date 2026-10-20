using Parking.Identity.Application.Common.Interface;
using Parking.Identity.Application.DTOs;
using MediatR;

namespace Parking.Identity.Application.UseCase.Account.GetAllAccount
{
    public class GetAllAccountQueryHandler : IRequestHandler<GetAllAccountQuery, IEnumerable<AppUserDto>>
    {
        private readonly IAccountRepository repository;
        public GetAllAccountQueryHandler(IAccountRepository repository)
        {
            this.repository = repository;
        }

        public async Task<IEnumerable<AppUserDto>> Handle(GetAllAccountQuery request, CancellationToken cancellationToken)
        {
            var accounts = await repository.GetAllAccountUser();

            return accounts.Select(x => new AppUserDto
            {
                Id = x.Id,
                FullName = x.FullName,
                EmailNormalized = x.EmailNormalized,
                PhoneE164 = x.PhoneE164,
                Status = x.Status,
                CreatedAt = x.CreatedAt,
                UpdatedAt = x.UpdatedAt
            });
        }
    }
}
