using MediatR;
using Parking.Identity.Application.Common.Interface;

namespace Parking.Identity.Application.UseCase.StaffAssignment.RevokeAssignment
{
    public class RevokeLotStaffAssignmentCommandHandler : IRequestHandler<RevokeLotStaffAssignmentCommand, RevokeAssignmentResult>
    {
        private readonly IAssignedLotRepository repository;
        private readonly IAuditLogRepository auditLogRepository;
        private readonly IUnitOfWork unitOfWork;

        public RevokeLotStaffAssignmentCommandHandler(
            IAssignedLotRepository repository,
            IAuditLogRepository auditLogRepository,
            IUnitOfWork unitOfWork)
        {
            this.repository = repository;
            this.auditLogRepository = auditLogRepository;
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

            var oldRevokedAt = assignment.RevokedAt;
            assignment.RevokedAt = DateTime.UtcNow;

            var auditLog = new Domain.Entities.AuditLog
            {
                Id = Guid.NewGuid(),
                LotId = assignment.LotId,
                ActorUserId = request.ActorId == Guid.Empty ? null : request.ActorId,
                ActorType = "USER",
                Action = "REVOKE_STAFF",
                EntityType = "LOT_STAFF_ASSIGNMENT",
                EntityId = assignment.Id.ToString(),
                Reason = "Staff assignment revoked",
                OldValues = System.Text.Json.JsonSerializer.Serialize(new
                {
                    assignment.LotId,
                    assignment.UserId,
                    assignment.RoleCode,
                    RevokedAt = oldRevokedAt
                }),
                NewValues = System.Text.Json.JsonSerializer.Serialize(new
                {
                    assignment.LotId,
                    assignment.UserId,
                    assignment.RoleCode,
                    assignment.RevokedAt
                }),
                CreatedAt = DateTime.UtcNow
            };
            await auditLogRepository.AddAsync(auditLog, cancellationToken);

            await unitOfWork.SaveChangesAsync(cancellationToken);

            return RevokeAssignmentResult.Success;
        }

    }
}
