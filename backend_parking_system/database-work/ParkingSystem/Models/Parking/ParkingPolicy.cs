using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace ParkingSystem.Models;

public class ParkingPolicy : Entity
{
    public Guid ParkingLotId { get; set; }
    public ParkingLot ParkingLot { get; set; } = null!;
    public bool AllowGuestBookings { get; set; } = true;
    public int PaymentHoldMinutes { get; set; } = 15;
    public int MinimumBookingMinutes { get; set; } = 30;
    public int MaximumBookingMinutes { get; set; } = 1440;
    public bool RequireFullPrepayment { get; set; } = true;
    public bool RefundUnusedTimeOnEarlyExit { get; set; } = false;
    public bool ChargeOvertime { get; set; } = true;
    // Null means not agreed/configured yet; do not silently interpret as zero.
    public int? EarlyArrivalMinutes { get; set; }
    public int? LateArrivalMinutes { get; set; }
    public int? QrLifetimeMinutes { get; set; }
    public int? ExitGraceMinutes { get; set; }
    public int? CancellationRefundCutoffMinutes { get; set; }
    public decimal? CancellationRefundPercent { get; set; }
}