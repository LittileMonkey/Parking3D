using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Identity.Domain.Entities
{
    public class UserVehicle
    {
        public Guid Id { get; set; }

        public Guid UserId { get; set; }

        public string LicensePlate { get; set; } = string.Empty;

        public string VehicleType { get; set; } = string.Empty;

        public bool IsDefault { get; set; }

        public DateTime CreatedAt { get; set; }

        public DateTime UpdatedAt { get; set; }

        public virtual AppUser User { get; set; } = null!;
    }
}
