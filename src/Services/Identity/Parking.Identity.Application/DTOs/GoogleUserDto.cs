using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Identity.Application.DTOs
{
    public record GoogleUserDto(
         string GoogleSubject,
         string Email,
         bool EmailVerified,
         string? FullName
    );
}
