using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Identity.Domain.Entities
{
    public class PasswordResetOtp
    {
        public Guid Id { get; set; }
        public Guid UserId { get; set; }

        public string OtpHash { get; set; } = string.Empty;

        public DateTimeOffset ExpiresAt { get; set; }

        public DateTimeOffset? UsedAt { get; set; }

        public int AttemptCount { get; set; }

        public DateTimeOffset CreatedAt { get; set; }
    }
}
