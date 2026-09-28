using System.ComponentModel.DataAnnotations;
using ParkingProject.Domain;

namespace ParkingProject.Contracts;

public record CreateGuestBooking(
    [Required, RegularExpression(@"^[A-Za-z0-9.\- ]{5,16}$")] string Plate,
    [EnumDataType(typeof(VehicleType))] VehicleType VehicleType,
    [Required, RegularExpression(@"^\+?[0-9]{9,15}$")] string Phone,
    [StringLength(24)] string? SlotId);

public record BookingView(Guid Id, string SlotId, BookingStatus Status, DateTimeOffset CreatedAt, DateTimeOffset HoldUntil);
public record BookingCreated(BookingView Booking, string AccessToken);
