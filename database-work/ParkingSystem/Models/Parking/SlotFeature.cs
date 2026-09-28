using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace ParkingSystem.Models;

public class SlotFeature : Entity
{
    [Required, MaxLength(40)] public string Code { get; set; } = string.Empty;
    [Required, MaxLength(100)] public string Name { get; set; } = string.Empty;
    public ICollection<ParkingSlotFeature> Slots { get; set; } = new List<ParkingSlotFeature>();
}