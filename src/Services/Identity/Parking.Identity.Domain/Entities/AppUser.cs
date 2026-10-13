using System;
using System.Collections.Generic;

namespace Parking.Identity.Domain.Entities;

public partial class AppUser
{
    public Guid Id { get; set; }

    public string? EmailNormalized { get; set; }

    public string? PhoneE164 { get; set; }

    public string FullName { get; set; } = null!;

    public string? PasswordHash { get; set; }

    public DateTime? EmailVerifiedAt { get; set; }

    public DateTime? PhoneVerifiedAt { get; set; }

    public string Status { get; set; } = null!;

    public DateTime? LockedUntil { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual ICollection<AuthToken> AuthTokens { get; set; } = new List<AuthToken>();

    public virtual ICollection<LotStaffAssignment> LotStaffAssignments { get; set; } = new List<LotStaffAssignment>();

    public virtual ICollection<PlatformUserRole> PlatformUserRoles { get; set; } = new List<PlatformUserRole>();
}
