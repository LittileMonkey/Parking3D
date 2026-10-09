using System;
using System.Collections.Generic;

namespace Parking.Identity.Domain.Entities;

public partial class AuditLog
{
    public Guid Id { get; set; }

    public Guid? LotId { get; set; }

    public Guid? ActorUserId { get; set; }

    public string ActorType { get; set; } = null!;

    public string Action { get; set; } = null!;

    public string EntityType { get; set; } = null!;

    public string EntityId { get; set; } = null!;

    public string? Reason { get; set; }

    public string? RequestId { get; set; }

    public string? OldValues { get; set; }

    public string? NewValues { get; set; }

    public DateTime CreatedAt { get; set; }
}
