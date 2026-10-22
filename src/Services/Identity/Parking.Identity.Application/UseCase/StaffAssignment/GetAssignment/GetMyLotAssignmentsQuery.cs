using MediatR;
using Parking.Identity.Application.DTOs;

namespace Parking.Identity.Application.UseCase.StaffAssignment.GetAssignment
{
    public record GetMyLotAssignmentsQuery : IRequest<IReadOnlyList<LotsAssignmentDto>>
    {
        public Guid userId { get; set; }
    }
}
