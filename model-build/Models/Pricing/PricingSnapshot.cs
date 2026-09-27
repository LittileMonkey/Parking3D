using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace ParkingSystem.Models;

public class PricingSnapshot : Entity
{
    public Guid PricingPlanId { get; set; }
    public PricingPlan PricingPlan { get; set; } = null!;
    public Guid? BookingId { get; set; }
    public Booking? Booking { get; set; }
    public Guid? ParkingSessionId { get; set; }
    public ParkingSession? ParkingSession { get; set; }
    public int PricingPlanVersion { get; set; }
    [Column(TypeName = "jsonb")] public string ResolvedRulesJson { get; set; } = "{}";
    [Required, StringLength(3)] public string Currency { get; set; } = "VND";
    public DateTimeOffset CapturedAt { get; set; } = DateTimeOffset.UtcNow;
}