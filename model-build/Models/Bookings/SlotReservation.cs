using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace ParkingSystem.Models;

public class SlotReservation : Entity
{
    public Guid BookingId { get; set; }
    public Booking Booking { get; set; } = null!;
    public Guid ParkingSlotId { get; set; }
    public ParkingSlot ParkingSlot { get; set; } = null!;
    public DateTimeOffset ReservedFrom { get; set; }
    public DateTimeOffset ReservedUntil { get; set; }
    public ReservationStatus Status { get; set; } = ReservationStatus.Held;
    public DateTimeOffset? ReleasedAt { get; set; }
    [MaxLength(500)] public string? ReleaseReason { get; set; }
}