using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace ParkingSystem.Models;

public class ParkingSlotFeature : Entity
{
    public Guid ParkingSlotId { get; set; }
    public ParkingSlot ParkingSlot { get; set; } = null!;
    public Guid SlotFeatureId { get; set; }
    public SlotFeature SlotFeature { get; set; } = null!;
}