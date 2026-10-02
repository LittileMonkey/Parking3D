using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace ParkingSystem.Models;

public class User : Entity
{
    [Required, MaxLength(150)] public string FullName { get; set; } = string.Empty;
    [MaxLength(254)] public string? Email { get; set; }
    [MaxLength(32)] public string? PhoneNumber { get; set; }
    [Required, MaxLength(512), JsonIgnore] public string PasswordHash { get; set; } = string.Empty;
    public PlatformRole PlatformRole { get; set; } = PlatformRole.Customer;
    public UserStatus Status { get; set; } = UserStatus.Active;
    public DateTimeOffset? PhoneVerifiedAt { get; set; }
    public ICollection<Vehicle> Vehicles { get; set; } = new List<Vehicle>();
    public ICollection<FacilityStaffAssignment> StaffAssignments { get; set; } = new List<FacilityStaffAssignment>();
}