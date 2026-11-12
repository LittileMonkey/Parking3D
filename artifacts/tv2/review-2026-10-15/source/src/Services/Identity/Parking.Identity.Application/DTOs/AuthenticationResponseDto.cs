using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Identity.Application.DTOs
{
    public class AuthenticationResponseDto
    {
        public Guid UserId { get; set; }

        public string FullName { get; set; } = null!;

        public string EmailNormalized { get; set; } = null!;

        public string Status { get; set; } = null!;

        public string AccessToken { get; set; } = null!;
        public string RefreshToken { get; set; } = null!;

        public string Role { get; set; } = null!;
    }
}
