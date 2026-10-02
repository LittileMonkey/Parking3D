using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace ParkingSystem.Models;

public class PricingRule : Entity
{
    public Guid ParkingLotId { get; set; }
    public Guid PricingPlanId { get; set; }
    public PricingPlan PricingPlan { get; set; } = null!;
    public Guid? ZoneId { get; set; }
    public Zone? Zone { get; set; }
    public PricingRuleType RuleType { get; set; }
    public VehicleType VehicleType { get; set; }
    public int Priority { get; set; }
    // Validate a typed rule payload in the pricing service before saving/publishing.
    [Column(TypeName = "jsonb")] public string ParametersJson { get; set; } = "{}";
}