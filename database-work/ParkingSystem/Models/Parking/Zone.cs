using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace ParkingSystem.Models;

public class Zone : Entity
{
    public Guid ParkingLotId { get; set; }
    public Guid ParkingLevelId { get; set; }
    public ParkingLevel ParkingLevel { get; set; } = null!;
    [Required, MaxLength(32)] public string Code { get; set; } = string.Empty;
    [Required, MaxLength(100)] public string Name { get; set; } = string.Empty;
    public OperationalStatus Status { get; set; } = OperationalStatus.Active;
    public int AllocationPriority { get; set; }
    public ICollection<ParkingSlot> Slots { get; set; } = new List<ParkingSlot>();
}