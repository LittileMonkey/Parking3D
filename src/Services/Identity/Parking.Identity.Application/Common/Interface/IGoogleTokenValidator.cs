using Parking.Identity.Application.DTOs;

namespace Parking.Identity.Application.Common.Interface
{
    public interface IGoogleTokenValidator
    {
        Task<GoogleUserDto> ValidateAsync(string idToken, CancellationToken cancellationToken = default);
    }
}
