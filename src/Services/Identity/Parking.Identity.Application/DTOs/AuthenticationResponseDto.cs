namespace Parking.Identity.Application.DTOs
{
    public class AuthenticationResponseDto
    {
        public string AccessToken { get; set; } = null!;
        public string RefreshToken { get; set; } = null!;
    }
}
