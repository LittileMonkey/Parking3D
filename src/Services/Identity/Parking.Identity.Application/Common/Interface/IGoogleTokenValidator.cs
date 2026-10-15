using Parking.Identity.Application.DTOs;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Identity.Application.Common.Interface
{
    public interface IGoogleTokenValidator
    {
        Task<GoogleUserDto> ValidateAsync( string idToken, CancellationToken cancellationToken = default);
    }
}
