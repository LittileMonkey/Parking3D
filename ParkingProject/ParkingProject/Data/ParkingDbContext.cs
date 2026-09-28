using Microsoft.EntityFrameworkCore;
using ParkingProject.Domain;

namespace ParkingProject.Data;

public class ParkingDbContext(DbContextOptions<ParkingDbContext> options) : DbContext(options)
{
    public DbSet<ParkingSlot> Slots => Set<ParkingSlot>();
    public DbSet<Vehicle> Vehicles => Set<Vehicle>();
    public DbSet<Booking> Bookings => Set<Booking>();

    protected override void OnModelCreating(ModelBuilder model)
    {
        var slot = model.Entity<ParkingSlot>();
        slot.HasKey(x => x.Id);
        slot.Property(x => x.Id).HasMaxLength(24);
        slot.Property(x => x.Floor).HasMaxLength(3);
        slot.Property(x => x.Zone).HasMaxLength(16);
        slot.Property(x => x.VehicleType).HasConversion<string>().HasMaxLength(16);
        slot.Property(x => x.SlotType).HasConversion<string>().HasMaxLength(16);
        slot.Property(x => x.Status).HasConversion<string>().HasMaxLength(16);
        slot.Property(x => x.Version).IsRowVersion();
        slot.HasIndex(x => new { x.VehicleType, x.Status });

        var vehicle = model.Entity<Vehicle>();
        vehicle.HasIndex(x => x.Plate).IsUnique();
        vehicle.Property(x => x.Plate).HasMaxLength(16);
        vehicle.Property(x => x.Type).HasConversion<string>().HasMaxLength(16);

        var booking = model.Entity<Booking>();
        booking.Property(x => x.Status).HasConversion<string>().HasMaxLength(16);
        booking.Property(x => x.GuestPhone).HasMaxLength(20);
        booking.Property(x => x.AccessTokenHash).HasMaxLength(64);
        booking.HasOne(x => x.Vehicle).WithMany().HasForeignKey(x => x.VehicleId).OnDelete(DeleteBehavior.Restrict);
        booking.HasOne(x => x.Slot).WithMany().HasForeignKey(x => x.SlotId).OnDelete(DeleteBehavior.Restrict);
        const string active = "\"Status\" IN ('PENDING', 'CONFIRMED', 'CHECKED_IN')";
        booking.HasIndex(x => x.VehicleId).IsUnique().HasFilter(active);
        booking.HasIndex(x => x.SlotId).IsUnique().HasFilter(active);
        booking.HasIndex(x => new { x.Status, x.HoldUntil });
    }
}
