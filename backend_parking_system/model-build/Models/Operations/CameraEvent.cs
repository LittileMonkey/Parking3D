using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace ParkingSystem.Models;

public class CameraEvent : Entity
{
    public Guid ParkingLotId { get; set; }
    public ParkingLot ParkingLot { get; set; } = null!;
    [Required, MaxLength(128)] public string ExternalEventId { get; set; } = string.Empty;
    [Required, MaxLength(64)] public string CameraId { get; set; } = string.Empty;
    public Guid? ParkingSlotId { get; set; }
    public ParkingSlot? ParkingSlot { get; set; }
    public CameraEventType EventType { get; set; }
    public DateTimeOffset OccurredAt { get; set; }
    [MaxLength(32)] public string? PlateNumber { get; set; }
    [Range(0d, 1d)] public double? Confidence { get; set; }
    public EventReviewStatus ReviewStatus { get; set; } = EventReviewStatus.Pending;
    public Guid? ReviewedByUserId { get; set; }
    public User? ReviewedByUser { get; set; }
    public DateTimeOffset? ReviewedAt { get; set; }
}