using Parking.Identity.Application.DTOs;
using Parking.Identity.Domain.Entities;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Identity.Application.Common.Interface
{
    public interface IAssignedLotRepository
    {
        Task<LotStaffAssignment?> GetAssignmentByIdAsync(Guid assignmentId,CancellationToken cancellationToken);
        Task<IReadOnlyList<LotStaffAssignment>> GetActiveStaffAssignedById(Guid userId, CancellationToken cancellationToken);
        Task<bool> HasActiveAssignmentAsync(Guid userId, Guid lotId, string? RoleCode, CancellationToken cancellationToken);
        Task AddStaffAssignmentAsync(LotStaffAssignment lotStaffAssignment, CancellationToken cancellationToken);
        Task<bool> CanRevokeStaffAsync(Guid userId, Guid lotId, CancellationToken cancellationToken);
        Task<bool> CheckAccessAsync(Guid userId, Guid lotId, string capability, CancellationToken cancellationToken);
    }
}
