using MediatR;

namespace Parking.Identity.Application.UseCase.StaffAssignment.RevokeAssignment
{
    public record RevokeLotStaffAssignmentCommand : IRequest<RevokeAssignmentResult>
    {
        public RevokeLotStaffAssignmentCommand(Guid assignmentId, Guid actorId)
        {
            AssignmentId = assignmentId;
            ActorId = actorId;
        }

        public Guid AssignmentId { get; set; }
        public Guid ActorId { get; set; }

    }

    public enum RevokeAssignmentResult
    {
        Success,
        NotFound,
        Forbidden,
        AlreadyRevoked,
        InvalidTarget
    }
}
