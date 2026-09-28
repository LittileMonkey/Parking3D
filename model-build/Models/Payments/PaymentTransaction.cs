using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace ParkingSystem.Models;

public class PaymentTransaction : Entity
{
    public Guid PaymentId { get; set; }
    public Payment Payment { get; set; } = null!;
    [Required, MaxLength(40)] public string Provider { get; set; } = string.Empty;
    [MaxLength(128)] public string? ProviderReference { get; set; }
    [Required, MaxLength(128)] public string RequestReference { get; set; } = string.Empty;
    [MaxLength(200)] public string? EventKey { get; set; }
    public TransactionType Type { get; set; }
    public TransactionStatus Status { get; set; } = TransactionStatus.Pending;
    [Column(TypeName = "numeric(18,2)")] public decimal Amount { get; set; }
    [MaxLength(40)] public string? ResponseCode { get; set; }
    public DateTimeOffset? VerifiedAt { get; set; }
}