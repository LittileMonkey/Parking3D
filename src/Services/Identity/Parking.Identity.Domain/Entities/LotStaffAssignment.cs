using System;
using System.Collections.Generic;

namespace Parking.Identity.Domain.Entities;

public partial class LotStaffAssignment
{
    public Guid Id { get; set; }

    public Guid LotId { get; set; }

    public Guid UserId { get; set; }

    public string RoleCode { get; set; } = null!;

    public DateTime ValidFrom { get; set; }

    public DateTime? ValidUntil { get; set; }

    public DateTime? RevokedAt { get; set; }

    public bool CanManageStaffAssignments { get; set; }

    public virtual AppUser User { get; set; } = null!;
}
