using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace ParkingSystem.Models;

public class Booking : Entity
{
    [Required, MaxLength(40)] public string BookingCode { get; set; } = string.Empty;
    public Guid ParkingLotId { get; set; }
    public ParkingLot ParkingLot { get; set; } = null!;
    public Guid? UserId { get; set; }
    public User? User { get; set; }
    public Guid? VehicleId { get; set; }
    public Vehicle? Vehicle { get; set; }
    [Required, MaxLength(32)] public string PlateSnapshot { get; set; } = string.Empty;
    [Required, MaxLength(32)] public string NormalizedPlate { get; set; } = string.Empty;
    public VehicleType VehicleType { get; set; }
    [MaxLength(32)] public string? GuestPhoneNumber { get; set; }
    public Guid? GuestOtpChallengeId { get; set; }
    public OtpChallenge? GuestOtpChallenge { get; set; }
    public BookingMode Mode { get; set; }
    public DateTimeOffset StartAt { get; set; }
    public DateTimeOffset EndAt { get; set; }
    public DateTimeOffset HoldExpiresAt { get; set; }
    public BookingStatus Status { get; set; } = BookingStatus.PendingPayment;
    [Column(TypeName = "numeric(18,2)")] public decimal QuotedTotal { get; set; }
    [Required, StringLength(3)] public string Currency { get; set; } = "VND";
    [ConcurrencyCheck] public long Version { get; set; } = 1;
    public ICollection<SlotReservation> Reservations { get; set; } = new List<SlotReservation>();
    public ICollection<QRToken> QrTokens { get; set; } = new List<QRToken>();
    public ICollection<Payment> Payments { get; set; } = new List<Payment>();
    public ParkingSession? Session { get; set; }
    public PricingSnapshot? PricingSnapshot { get; set; }
}