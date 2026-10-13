using MediatR;
using Parking.Identity.Application.DTOs;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Identity.Application.UseCase.StaffAssignment.GetAssignment
{
    public record GetMyLotAssignmentsQuery : IRequest<IReadOnlyList<LotsAssignmentDto>>
    {
        public Guid userId { get; set; }
    }
}
