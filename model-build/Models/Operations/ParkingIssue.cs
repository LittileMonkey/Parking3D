using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace ParkingSystem.Models;

public class ParkingIssue : Entity
{
    public Guid ParkingLotId { get; set; }
    public ParkingLot ParkingLot { get; set; } = null!;
    public Guid? ParkingSessionId { get; set; }
    public ParkingSession? ParkingSession { get; set; }
    public Guid? BookingId { get; set; }
    public Booking? Booking { get; set; }
    public Guid? CameraEventId { get; set; }
    public CameraEvent? CameraEvent { get; set; }
    public IssueType Type { get; set; }
    public IssueStatus Status { get; set; } = IssueStatus.Reported;
    [Required, MaxLength(2000)] public string Description { get; set; } = string.Empty;
    public Guid? ReportedByUserId { get; set; }
    public User? ReportedByUser { get; set; }
    public Guid? ResolvedByUserId { get; set; }
    public User? ResolvedByUser { get; set; }
    public DateTimeOffset? ResolvedAt { get; set; }
    [MaxLength(2000)] public string? Resolution { get; set; }
}