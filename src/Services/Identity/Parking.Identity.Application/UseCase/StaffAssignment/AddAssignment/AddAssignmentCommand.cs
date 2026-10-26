using MediatR;
using Parking.Identity.Application.DTOs;

namespace Parking.Identity.Application.UseCase.StaffAssignment.AddAssignment
{
    public record AddAssignmentCommand : IRequest<LotsAssignmentDto>
    {
        public Guid ActorId { get; set; }

        public Guid UserId { get; init; }

        public Guid LotId { get; init; }

        public string RoleCode { get; init; } = string.Empty;

        public DateTime ValidFrom { get; init; }

        public DateTime? ValidUntil { get; init; }

        public bool CanManageStaffAssignments { get; init; }
    }
}
