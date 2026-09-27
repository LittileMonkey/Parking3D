using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace ParkingSystem.Models;

public class FacilityStaffAssignment : Entity
{
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public Guid ParkingLotId { get; set; }
    public ParkingLot ParkingLot { get; set; } = null!;
    public LotRole Role { get; set; } = LotRole.Staff;
    public DateTimeOffset ActiveFrom { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? ActiveTo { get; set; }
    public DateTimeOffset? RevokedAt { get; set; }
    public Guid? AssignedByUserId { get; set; }
    public User? AssignedByUser { get; set; }
    // Explicit delegation; being a Manager alone does not grant staff-assignment permission.
    public bool CanManageStaffAssignments { get; set; }
}