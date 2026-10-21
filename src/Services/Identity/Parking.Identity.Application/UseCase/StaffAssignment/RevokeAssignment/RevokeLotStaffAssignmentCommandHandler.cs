using MediatR;
using Parking.Identity.Application.Common.Interface;

namespace Parking.Identity.Application.UseCase.StaffAssignment.RevokeAssignment
{
    public class RevokeLotStaffAssignmentCommandHandler : IRequestHandler<RevokeLotStaffAssignmentCommand, RevokeAssignmentResult>
    {
        private readonly IAssignedLotRepository repository;
        private readonly IUnitOfWork unitOfWork;
        public RevokeLotStaffAssignmentCommandHandler(IAssignedLotRepository repository, IUnitOfWork unitOfWork)
        {
            this.repository = repository;
            this.unitOfWork = unitOfWork;
        }
        public async Task<RevokeAssignmentResult> Handle(RevokeLotStaffAssignmentCommand request, CancellationToken cancellationToken)
        {
            var assignment = await repository.GetAssignmentByIdAsync(request.AssignmentId, cancellationToken);

            if (assignment is null)
            {
                return RevokeAssignmentResult.NotFound;
            }

            if (assignment.RevokedAt is not null)
            {
                return RevokeAssignmentResult.AlreadyRevoked;
            }

            if (assignment.RoleCode != "PARKING_STAFF")
            {
                return RevokeAssignmentResult.InvalidTarget;
            }

            var allowed = await repository.CanRevokeStaffAsync(request.ActorId, assignment.LotId, cancellationToken);


            if (!allowed)
                return RevokeAssignmentResult.Forbidden;


            assignment.RevokedAt = DateTime.UtcNow;

            await unitOfWork.SaveChangesAsync(cancellationToken);

            return RevokeAssignmentResult.Success;
        }

    }
}
