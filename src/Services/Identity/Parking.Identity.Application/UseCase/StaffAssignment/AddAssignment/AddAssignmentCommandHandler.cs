using MediatR;
using Parking.Identity.Application.Common.AppException;
using Parking.Identity.Application.Common.Enum;
using Parking.Identity.Application.Common.Interface;
using Parking.Identity.Application.DTOs;
using Parking.Identity.Domain.Entities;

namespace Parking.Identity.Application.UseCase.StaffAssignment.AddAssignment
{
    public class AddAssignmentCommandHandler : IRequestHandler<AddAssignmentCommand, LotsAssignmentDto>
    {
        private readonly IAssignedLotRepository repository;
        private readonly IAccountRepository accountRepository;
        private readonly IAuditLogRepository auditLogRepository;
        private readonly IUnitOfWork unitOfWork;

        public AddAssignmentCommandHandler(
            IAssignedLotRepository repository,
            IAccountRepository accountRepository,
            IAuditLogRepository auditLogRepository,
            IUnitOfWork unitOfWork)
        {
            this.repository = repository;
            this.accountRepository = accountRepository;
            this.auditLogRepository = auditLogRepository;
            this.unitOfWork = unitOfWork;
        }

        public async Task<LotsAssignmentDto> Handle(AddAssignmentCommand request, CancellationToken cancellationToken)
        {
            // 1. Kiểm tra quyền hạn cơ sở (Actor phải là ADMIN hoặc MANAGER có quyền quản lý tại lot này)
            var allowed = await repository.CanRevokeStaffAsync(request.ActorId, request.LotId, cancellationToken);
            if (!allowed)
            {
                throw new AppException(ErrorCode.Unauthorized, "You do not have permission to manage staff assignments for this lot.");
            }

            // 2. Validate RoleCode
            if (string.IsNullOrWhiteSpace(request.RoleCode) ||
                (request.RoleCode != "PARKING_STAFF" && request.RoleCode != "PARKING_MANAGER"))
            {
                throw new AppException(ErrorCode.InvalidRequest, "RoleCode must be PARKING_STAFF or PARKING_MANAGER.");
            }

            // 3. Validate thời hạn gán quyền
            if (request.ValidUntil.HasValue && request.ValidUntil.Value <= request.ValidFrom)
            {
                throw new AppException(ErrorCode.InvalidRequest, "ValidUntil must be greater than ValidFrom.");
            }

            // 4. Kiểm tra tài khoản nhân viên được gán có tồn tại không
            var targetUser = await accountRepository.GetUserByIdAsync(request.UserId, cancellationToken);
            if (targetUser is null)
            {
                throw new AppException(ErrorCode.AccountNotFound, "The target staff account was not found.");
            }

            // 5. Kiểm tra tài khoản đã có phân công hoạt động ở bãi này chưa
            var hasActiveAssignment = await repository.HasActiveAssignmentAsync(request.UserId, request.LotId, request.RoleCode, cancellationToken);
            if (hasActiveAssignment)
            {
                throw new AppException(ErrorCode.InvalidRequest, "This user already has an active assignment for this lot.");
            }

            var assignment = new LotStaffAssignment
            {
                Id = Guid.NewGuid(),
                LotId = request.LotId,
                UserId = request.UserId,
                RoleCode = request.RoleCode,
                ValidFrom = request.ValidFrom == default ? DateTime.UtcNow : request.ValidFrom,
                ValidUntil = request.ValidUntil,
                RevokedAt = null,
                CanManageStaffAssignments = request.CanManageStaffAssignments
            };

            await repository.AddStaffAssignmentAsync(assignment, cancellationToken);

            var auditLog = new AuditLog
            {
                Id = Guid.NewGuid(),
                LotId = request.LotId,
                ActorUserId = request.ActorId == Guid.Empty ? null : request.ActorId,
                ActorType = "USER",
                Action = "ASSIGN_STAFF",
                EntityType = "LOT_STAFF_ASSIGNMENT",
                EntityId = assignment.Id.ToString(),
                NewValues = System.Text.Json.JsonSerializer.Serialize(new
                {
                    assignment.LotId,
                    assignment.UserId,
                    assignment.RoleCode,
                    assignment.ValidFrom,
                    assignment.ValidUntil,
                    assignment.CanManageStaffAssignments
                }),
                CreatedAt = DateTime.UtcNow
            };
            await auditLogRepository.AddAsync(auditLog, cancellationToken);

            await unitOfWork.SaveChangesAsync(cancellationToken);

            return new LotsAssignmentDto
            {
                AssignmentId = assignment.Id,
                LotId = assignment.LotId,
                RoleCode = assignment.RoleCode,
                ValidFrom = assignment.ValidFrom,
                ValidUntil = assignment.ValidUntil,
                CanManageStaffAssignments = assignment.CanManageStaffAssignments
            };
        }
    }
}
