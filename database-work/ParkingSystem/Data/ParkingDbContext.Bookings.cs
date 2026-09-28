using Microsoft.EntityFrameworkCore;
using ParkingSystem.Models;

namespace ParkingSystem.Data;

public sealed partial class ParkingDbContext
{
    private static void ConfigureBookings(ModelBuilder m)
    {
        var b = m.Entity<Booking>();
        b.HasAlternateKey(x => new { x.Id, x.ParkingLotId });
        b.HasIndex(x => x.BookingCode).IsUnique();
        b.HasIndex(x => x.GuestOtpChallengeId).IsUnique().HasFilter("\"GuestOtpChallengeId\" IS NOT NULL");
        b.HasIndex(x => new { x.ParkingLotId, x.StartAt });
        b.HasIndex(x => new { x.Status, x.HoldExpiresAt });
        b.ToTable(t => {
            t.HasCheckConstraint("CK_Bookings_Interval", "\"StartAt\" < \"EndAt\"");
            t.HasCheckConstraint("CK_Bookings_Amount", "\"QuotedTotal\" >= 0");
            t.HasCheckConstraint("CK_Bookings_Guest", "(\"UserId\" IS NULL AND \"GuestPhoneNumber\" IS NOT NULL AND \"GuestOtpChallengeId\" IS NOT NULL) OR (\"UserId\" IS NOT NULL AND \"VehicleId\" IS NOT NULL AND \"GuestOtpChallengeId\" IS NULL)");
            t.HasCheckConstraint("CK_Bookings_Plate", "\"NormalizedPlate\" ~ '^[A-Z0-9]+$'");
        });
        var r = m.Entity<SlotReservation>();
        r.HasOne(x => x.Booking).WithMany(x => x.Reservations).HasForeignKey(x => new { x.BookingId, x.ParkingLotId }).HasPrincipalKey(x => new { x.Id, x.ParkingLotId });
        r.HasOne(x => x.ParkingSlot).WithMany().HasForeignKey(x => new { x.ParkingSlotId, x.ParkingLotId }).HasPrincipalKey(x => new { x.Id, x.ParkingLotId });
        r.HasIndex(x => x.BookingId).IsUnique().HasFilter("\"Status\" IN (0,1)");
        r.ToTable(t => t.HasCheckConstraint("CK_Reservations_Interval", "\"ReservedFrom\" < \"ReservedUntil\""));
        var session = m.Entity<ParkingSession>();
        session.HasAlternateKey(x => new { x.Id, x.ParkingLotId });
        session.HasOne(x => x.Booking).WithOne(x => x.Session).HasForeignKey<ParkingSession>(x => new { x.BookingId, x.ParkingLotId }).HasPrincipalKey<Booking>(x => new { x.Id, x.ParkingLotId });
        session.HasIndex(x => x.BookingId).IsUnique().HasFilter("\"BookingId\" IS NOT NULL");
        session.HasOne(x => x.ParkingSlot).WithMany().HasForeignKey(x => new { x.ParkingSlotId, x.ParkingLotId }).HasPrincipalKey(x => new { x.Id, x.ParkingLotId });
        session.HasIndex(x => x.ParkingSlotId).IsUnique().HasFilter("\"Status\" IN (0,1)");
        session.HasIndex(x => x.NormalizedPlate).IsUnique().HasFilter("\"Status\" IN (0,1)");
        session.ToTable(t => {
            t.HasCheckConstraint("CK_Sessions_Exit", "(\"Status\" = 2 AND \"ExitedAt\" IS NOT NULL AND \"ExitedAt\" >= \"EnteredAt\") OR (\"Status\" IN (0,1) AND \"ExitedAt\" IS NULL)");
            t.HasCheckConstraint("CK_Sessions_Fee", "\"FinalFee\" IS NULL OR \"FinalFee\" >= 0");
            t.HasCheckConstraint("CK_Sessions_Plate", "\"NormalizedPlate\" ~ '^[A-Z0-9]+$'");
        });
        m.Entity<QRToken>().HasIndex(x => x.NonceHash).IsUnique();
        m.Entity<QRToken>().ToTable(t => t.HasCheckConstraint("CK_QR_Expiry", "\"ExpiresAt\" > \"CreatedAt\""));
    }
}
