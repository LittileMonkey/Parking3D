using System;
using System.Collections.Generic;

namespace Parking.Identity.Domain.Entities;

public partial class IntegrationOutbox
{
    public Guid EventId { get; set; }

    public string EventType { get; set; } = null!;

    public Guid AggregateId { get; set; }

    public string Payload { get; set; } = null!;

    public DateTime OccurredAt { get; set; }

    public DateTime? DeliveredAt { get; set; }

    public int Attempts { get; set; }

    public DateTime NextAttemptAt { get; set; }

    public string? LastError { get; set; }
}
