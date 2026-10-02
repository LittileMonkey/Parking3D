using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace ParkingSystem.Models;

public class QRToken : Entity
{
    public Guid BookingId { get; set; }
    public Booking Booking { get; set; } = null!;
    [Required, MaxLength(128), JsonIgnore] public string NonceHash { get; set; } = string.Empty;
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset? ConsumedAt { get; set; }
    public DateTimeOffset? RevokedAt { get; set; }
}