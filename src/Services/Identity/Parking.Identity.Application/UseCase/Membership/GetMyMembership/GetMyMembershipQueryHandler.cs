using MediatR;
using Parking.Identity.Application.Common.AppException;
using Parking.Identity.Application.Common.Enum;
using Parking.Identity.Application.Common.Interface;
using Parking.Identity.Application.DTOs;

namespace Parking.Identity.Application.UseCase.Membership.GetMyMembership
{
    public class GetMyMembershipQueryHandler : IRequestHandler<GetMyMembershipQuery, MemberShipDto>
    {
        private readonly IAccountRepository accountRepository;
        private readonly IUserMembershipRepository membershipRepository;
        public GetMyMembershipQueryHandler(IAccountRepository accountRepository, IUserMembershipRepository membershipRepository)
        {
            this.accountRepository = accountRepository;
            this.membershipRepository = membershipRepository;
        }

        public async Task<MemberShipDto> Handle(GetMyMembershipQuery request, CancellationToken cancellationToken)
        {
            var memberShip = await membershipRepository.GetUserMembershipByUserIdAsync(request.UserId, cancellationToken);

            if (memberShip == null)
            {
                throw new AppException(ErrorCode.MembershipNotFound, "Membership was not found.");
            }

            return new MemberShipDto
            {
                UserId = memberShip.UserId,
                TierCode = memberShip.TierCode
            };
        }
    }
}
