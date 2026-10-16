using System;
using System.Collections.Generic;

namespace Parking.Identity.Domain.Entities;

public partial class IntegrationInbox
{
    public Guid EventId { get; set; }

    public string EventType { get; set; } = null!;

    public string PayloadHash { get; set; } = null!;

    public DateTime ReceivedAt { get; set; }

    public string Outcome { get; set; } = null!;
}
