using System;
using System.Collections.Generic;

namespace Parking.Identity.Domain.Entities;

public partial class ServiceSchemaVersion
{
    public int Version { get; set; }

    public DateTime AppliedAt { get; set; }
}
