using MediatR;
using Parking.Identity.Application.DTOs;

namespace Parking.Identity.Application.UseCase.Membership.GetMyMembership
{
    public record GetMyMembershipQuery : IRequest<MemberShipDto>
    {
        public Guid UserId { get; set; }
    }
}
