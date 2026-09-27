using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace ParkingSystem.Models;

public class MapVersion : Entity
{
    public Guid ParkingLotId { get; set; }
    public ParkingLot ParkingLot { get; set; } = null!;
    public int VersionNumber { get; set; }
    public MapStatus Status { get; set; } = MapStatus.Draft;
    public DateTimeOffset? PublishedAt { get; set; }
    public ICollection<MapObject> Objects { get; set; } = new List<MapObject>();
}