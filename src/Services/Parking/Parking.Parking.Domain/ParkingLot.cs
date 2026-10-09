using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Parking.Domain
{
    public class ParkingLot
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public double Latitude { get; set; }
        public double Longitude { get; set; }
        public int AvailableSlots { get; set; }
        public string Status { get; set; } = "ACTIVE";
    }

}
