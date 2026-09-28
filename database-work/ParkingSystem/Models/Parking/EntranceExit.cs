using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace ParkingSystem.Models;

public class EntranceExit : Entity
{
    public Guid ParkingLotId { get; set; }
    public ParkingLot ParkingLot { get; set; } = null!;
    [Required, MaxLength(32)] public string Code { get; set; } = string.Empty;
    [Required, MaxLength(100)] public string Name { get; set; } = string.Empty;
    public GateType GateType { get; set; }
    public bool IsActive { get; set; } = true;
}