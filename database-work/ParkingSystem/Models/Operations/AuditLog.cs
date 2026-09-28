using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace ParkingSystem.Models;

public class AuditLog : Entity
{
    public Guid? ActorUserId { get; set; }
    public User? ActorUser { get; set; }
    public AuditActorType ActorType { get; set; }
    public Guid? ParkingLotId { get; set; }
    public ParkingLot? ParkingLot { get; set; }
    [Required, MaxLength(100)] public string Action { get; set; } = string.Empty;
    [Required, MaxLength(100)] public string EntityType { get; set; } = string.Empty;
    [Required, MaxLength(128)] public string EntityId { get; set; } = string.Empty;
    [Column(TypeName = "jsonb")] public string? OldValueJson { get; set; }
    [Column(TypeName = "jsonb")] public string? NewValueJson { get; set; }
    [MaxLength(1000)] public string? Reason { get; set; }
    [MaxLength(128)] public string? RequestId { get; set; }
}