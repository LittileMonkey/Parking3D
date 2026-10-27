using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Identity.Application.DTOs
{
    public class MemberShipDto
    {
        public Guid UserId { get; set; }
        public string TierCode { get; set; } = string.Empty;
    }
}
