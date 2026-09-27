using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace ParkingSystem.Models;

public class MapObject : Entity
{
    public Guid MapVersionId { get; set; }
    public MapVersion MapVersion { get; set; } = null!;
    public Guid? ParkingLevelId { get; set; }
    public ParkingLevel? ParkingLevel { get; set; }
    public Guid? ParkingSlotId { get; set; }
    public ParkingSlot? ParkingSlot { get; set; }
    public MapObjectType ObjectType { get; set; }
    public double PositionX { get; set; }
    public double PositionY { get; set; }
    public double PositionZ { get; set; }
    public double RotationX { get; set; }
    public double RotationY { get; set; }
    public double RotationZ { get; set; }
    public double ScaleX { get; set; } = 1;
    public double ScaleY { get; set; } = 1;
    public double ScaleZ { get; set; } = 1;
    [Column(TypeName = "jsonb")] public string MetadataJson { get; set; } = "{}";
}