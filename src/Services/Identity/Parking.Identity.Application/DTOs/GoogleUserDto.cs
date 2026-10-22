namespace Parking.Identity.Application.DTOs
{
    public record GoogleUserDto(
         string GoogleSubject,
         string Email,
         bool EmailVerified,
         string? FullName
    );
}
