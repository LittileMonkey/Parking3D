using System;
using System.Collections.Generic;

namespace Parking.Identity.Domain.Entities;

public partial class PlatformUserRole
{
    public Guid UserId { get; set; }

    public string RoleCode { get; set; } = null!;

    public virtual AppUser User { get; set; } = null!;
}
