using MediatR;
using Parking.Identity.Application.Common.AppException;
using Parking.Identity.Application.Common.Enum;
using Parking.Identity.Application.Common.Interface;
using Parking.Identity.Application.DTOs;

namespace Parking.Identity.Application.UseCase.Membership.UpdateMemberShip
{
    public class UpdateMembershipCommandHandler : IRequestHandler<UpdateMembershipCommand, MemberShipDto>
    {
        private readonly IUserMembershipRepository userMembershipRepository;
        private readonly IUnitOfWork unitOfWork;
        public UpdateMembershipCommandHandler(IUserMembershipRepository userMembershipRepository, IUnitOfWork unitOfWork)
        {
            this.userMembershipRepository = userMembershipRepository;
            this.unitOfWork = unitOfWork;
        }
        public async Task<MemberShipDto> Handle(UpdateMembershipCommand request, CancellationToken cancellationToken)
        {
            var memberShip = await userMembershipRepository.GetUserMembershipByUserIdAsync(request.UserId, cancellationToken);
            if(memberShip == null)
            {
                throw new AppException(ErrorCode.MembershipNotFound, "Membership was not found.");
            }

            if (string.IsNullOrWhiteSpace(request.TierCode))
            {
                throw new AppException(ErrorCode.RequiredFieldMissing, "TierCode is required.");
            }

            var normalizedTier = request.TierCode.Trim().ToUpperInvariant();

            if (normalizedTier != Common.Constants.UserMembershipTierCode.STANDARD &&
                normalizedTier != Common.Constants.UserMembershipTierCode.SILVER &&
                normalizedTier != Common.Constants.UserMembershipTierCode.GOLD_STAR)
            {
                throw new AppException(ErrorCode.InvalidMembershipTier, "TierCode must be STANDARD, SILVER, or GOLD_STAR.");
            }

            memberShip.TierCode = normalizedTier;
            memberShip.UpdatedAt = DateTime.UtcNow;

            userMembershipRepository.UpdateUserMembership(memberShip);
            await unitOfWork.SaveChangesAsync(cancellationToken);


            return new MemberShipDto
            {
                UserId = memberShip.UserId,
                TierCode = memberShip.TierCode
            };
        }
    }
}
