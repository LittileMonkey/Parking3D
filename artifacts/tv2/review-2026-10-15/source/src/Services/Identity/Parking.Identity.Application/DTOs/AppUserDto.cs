using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Identity.Application.DTOs
{
    public class AppUserDto
    {
        public Guid Id { get; set; }
        public string? EmailNormalized { get; set; }
        public string? PhoneE164 { get; set; }
        public string FullName { get; set; } = null!;
        public DateTime? EmailVerifiedAt { get; set; }
        public DateTime? PhoneVerifiedAt { get; set; }
        public string Status { get; set; } = null!;

        public DateTime? LockedUntil { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public List<string> Roles { get; set; } = new List<string>();
    }
}
