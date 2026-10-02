using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace ParkingSystem.Models;

public class PricingPlan : Entity
{
    public Guid ParkingLotId { get; set; }
    public ParkingLot ParkingLot { get; set; } = null!;
    [Required, MaxLength(150)] public string Name { get; set; } = string.Empty;
    public int VersionNumber { get; set; }
    public DateTimeOffset EffectiveFrom { get; set; }
    public DateTimeOffset? EffectiveTo { get; set; }
    public PricingPlanStatus Status { get; set; } = PricingPlanStatus.Draft;
    [Required, StringLength(3)] public string Currency { get; set; } = "VND";
    public ICollection<PricingRule> Rules { get; set; } = new List<PricingRule>();
}