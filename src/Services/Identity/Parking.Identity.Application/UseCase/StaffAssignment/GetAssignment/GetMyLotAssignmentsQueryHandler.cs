using MediatR;
using Parking.Identity.Application.Common.Interface;
using Parking.Identity.Application.DTOs;
using System;
using System.Collections.Frozen;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Identity.Application.UseCase.StaffAssignment.GetAssignment
{
    public class GetMyLotAssignmentsQueryHandler : IRequestHandler<GetMyLotAssignmentsQuery , IReadOnlyList<LotsAssignmentDto>>
    {
        private readonly IAssignedLotRepository repository;
        private readonly IUnitOfWork unitOfWork;
        public GetMyLotAssignmentsQueryHandler(IAssignedLotRepository repository, IUnitOfWork unitOfWork)
        {
            this.repository = repository;
            this.unitOfWork = unitOfWork;
        }

        public async Task<IReadOnlyList<LotsAssignmentDto>> Handle(GetMyLotAssignmentsQuery request, CancellationToken cancellationToken)
        {
            var assignments  =  await repository.GetActiveStaffAssignedById(request.userId, cancellationToken);

            var result = assignments.Select(x => new LotsAssignmentDto
            {
                AssignmentId = x.Id,
                LotId = x.LotId,
                RoleCode = x.RoleCode,
                ValidFrom = x.ValidFrom,
                ValidUntil = x.ValidUntil,
                CanManageStaffAssignments = x.CanManageStaffAssignments
            }).ToList();

            return result;
        }
    }
}
