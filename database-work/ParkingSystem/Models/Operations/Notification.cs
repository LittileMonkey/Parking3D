using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace ParkingSystem.Models;

public class Notification : Entity
{
    public Guid? UserId { get; set; }
    public User? User { get; set; }
    public Guid? BookingId { get; set; }
    public Booking? Booking { get; set; }
    [MaxLength(254)] public string? Recipient { get; set; }
    public NotificationChannel Channel { get; set; } = NotificationChannel.Web;
    public NotificationStatus Status { get; set; } = NotificationStatus.Pending;
    [Required, MaxLength(200)] public string Title { get; set; } = string.Empty;
    [Required, MaxLength(4000)] public string Body { get; set; } = string.Empty;
    public DateTimeOffset? SentAt { get; set; }
    public DateTimeOffset? ReadAt { get; set; }
}