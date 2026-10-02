using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace ParkingSystem.Models;

public class Payment : Entity
{
    // Exactly one of BookingId/ParkingSessionId must be present.
    public Guid? BookingId { get; set; }
    public Booking? Booking { get; set; }
    public Guid? ParkingSessionId { get; set; }
    public ParkingSession? ParkingSession { get; set; }
    [Column(TypeName = "numeric(18,2)")] public decimal Amount { get; set; }
    [Required, StringLength(3)] public string Currency { get; set; } = "VND";
    public PaymentType Type { get; set; }
    public PaymentMethod Method { get; set; }
    public PaymentStatus Status { get; set; } = PaymentStatus.Pending;
    [Required, MaxLength(128)] public string IdempotencyKey { get; set; } = string.Empty;
    public DateTimeOffset? PaidAt { get; set; }
    public Guid? CashConfirmedByUserId { get; set; }
    public User? CashConfirmedByUser { get; set; }
    [ConcurrencyCheck] public long Version { get; set; } = 1;
    public ICollection<PaymentTransaction> Transactions { get; set; } = new List<PaymentTransaction>();
}