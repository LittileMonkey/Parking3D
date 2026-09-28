using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace ParkingSystem.Models;

public class OtpChallenge : Entity
{
    [Required, MaxLength(32)] public string PhoneNumber { get; set; } = string.Empty;
    [Required, MaxLength(32)] public string NormalizedPlate { get; set; } = string.Empty;
    public OtpPurpose Purpose { get; set; } = OtpPurpose.GuestBooking;
    // Store a keyed hash (HMAC), never the raw OTP. Keep the key outside the database.
    [Required, MaxLength(128), JsonIgnore] public string CodeHash { get; set; } = string.Empty;
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset? VerifiedAt { get; set; }
    public DateTimeOffset? ConsumedAt { get; set; }
    public DateTimeOffset? InvalidatedAt { get; set; }
    public int FailedAttempts { get; set; }
    public int MaxAttempts { get; set; } = 5;
}