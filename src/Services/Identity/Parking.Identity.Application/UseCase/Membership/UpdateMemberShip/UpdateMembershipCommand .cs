using MediatR;
using Parking.Identity.Application.DTOs;

namespace Parking.Identity.Application.UseCase.Membership.UpdateMemberShip
{
    public class UpdateMembershipCommand : IRequest<MemberShipDto>
    {
        public Guid UserId { get; set; }
        public string TierCode { get; set; } = string.Empty;
    }
}
