using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace ParkingSystem.Models;

public class ParkingSlot : Entity
{
    public Guid ParkingLotId { get; set; }
    public Guid ZoneId { get; set; }
    public Zone Zone { get; set; } = null!;
    [Required, MaxLength(32)] public string Code { get; set; } = string.Empty;
    public List<VehicleType> SupportedVehicleTypes { get; set; } = new();
    public OperationalStatus OperationalStatus { get; set; } = OperationalStatus.Active;
    public decimal? WidthMeters { get; set; }
    public decimal? LengthMeters { get; set; }
    public decimal? DistanceToExitMeters { get; set; }
    // Application-managed optimistic concurrency token; increment on every update.
    [ConcurrencyCheck] public long Version { get; set; } = 1;
    public ICollection<ParkingSlotFeature> Features { get; set; } = new List<ParkingSlotFeature>();
}