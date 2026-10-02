using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace ParkingSystem.Models;

public class ParkingSession : Entity
{
    public Guid ParkingLotId { get; set; }
    public ParkingLot ParkingLot { get; set; } = null!;
    public Guid? BookingId { get; set; }
    public Booking? Booking { get; set; }
    public Guid? VehicleId { get; set; }
    public Vehicle? Vehicle { get; set; }
    [Required, MaxLength(32)] public string PlateSnapshot { get; set; } = string.Empty;
    [Required, MaxLength(32)] public string NormalizedPlate { get; set; } = string.Empty;
    public VehicleType VehicleType { get; set; }
    public Guid ParkingSlotId { get; set; }
    public ParkingSlot ParkingSlot { get; set; } = null!;
    public DateTimeOffset EnteredAt { get; set; }
    public DateTimeOffset? ExitRequestedAt { get; set; }
    public DateTimeOffset? ExitedAt { get; set; }
    public DateTimeOffset? FeeCalculatedThrough { get; set; }
    public SessionStatus Status { get; set; } = SessionStatus.Active;
    [Column(TypeName = "numeric(18,2)")] public decimal? FinalFee { get; set; }
    [Required, StringLength(3)] public string Currency { get; set; } = "VND";
    [ConcurrencyCheck] public long Version { get; set; } = 1;
    public PricingSnapshot? PricingSnapshot { get; set; }
    public ICollection<Payment> Payments { get; set; } = new List<Payment>();
}