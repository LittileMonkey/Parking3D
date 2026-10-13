using MediatR;
using Parking.Identity.Application.Common.Interface;
using Parking.Identity.Application.DTOs;

namespace Parking.Identity.Application.UseCase.LotStaffAssignment.AddAssignment
{
    public class AddAssignmentCommandHandler : IRequestHandler<AddAssignmentCommand, LotsAssignmentDto>
    {
        private readonly IAssignedLotRepository repository;
        private readonly IUnitOfWork unitOfWork;
        public AddAssignmentCommandHandler(IAssignedLotRepository repository, IUnitOfWork unitOfWork)
        {
            this.repository = repository;
            this.unitOfWork = unitOfWork;
        }
        public async Task<LotsAssignmentDto> Handle(AddAssignmentCommand request, CancellationToken cancellationToken)
        {
            var assignment = new Domain.Entities.LotStaffAssignment
            {
                Id = Guid.NewGuid(),
                LotId = request.LotId,
                UserId = request.UserId,
                RoleCode = request.RoleCode,
                ValidFrom = request.ValidFrom,
                ValidUntil = request.ValidUntil,
                RevokedAt = null,
                CanManageStaffAssignments = request.CanManageStaffAssignments
            };

            await repository.AddStaffAssignmentAsync(assignment, cancellationToken);
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
