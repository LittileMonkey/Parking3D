using Microsoft.EntityFrameworkCore;
using ParkingSystem.Models;

namespace ParkingSystem.Data;

public sealed partial class ParkingDbContext
{
    private static void ConfigureParking(ModelBuilder m)
    {
        m.Entity<ParkingLot>().HasIndex(x => x.Code).IsUnique();
        m.Entity<ParkingLot>().ToTable(t => t.HasCheckConstraint("CK_Lots_Coordinates", "\"Latitude\" BETWEEN -90 AND 90 AND \"Longitude\" BETWEEN -180 AND 180"));
        var level = m.Entity<ParkingLevel>();
        level.HasAlternateKey(x => new { x.Id, x.ParkingLotId });
        level.HasIndex(x => new { x.ParkingLotId, x.Code }).IsUnique();
        var zone = m.Entity<Zone>();
        zone.HasAlternateKey(x => new { x.Id, x.ParkingLotId });
        zone.HasIndex(x => new { x.ParkingLevelId, x.Code }).IsUnique();
        zone.HasOne(x => x.ParkingLevel).WithMany(x => x.Zones)
            .HasForeignKey(x => new { x.ParkingLevelId, x.ParkingLotId }).HasPrincipalKey(x => new { x.Id, x.ParkingLotId });
        var slot = m.Entity<ParkingSlot>();
        slot.HasAlternateKey(x => new { x.Id, x.ParkingLotId });
        slot.HasOne(x => x.Zone).WithMany(x => x.Slots)
            .HasForeignKey(x => new { x.ZoneId, x.ParkingLotId }).HasPrincipalKey(x => new { x.Id, x.ParkingLotId });
        slot.HasIndex(x => new { x.ZoneId, x.Code }).IsUnique();
        slot.Property(x => x.SupportedVehicleTypes).HasColumnType("integer[]");
        slot.ToTable(t => {
            t.HasCheckConstraint("CK_Slots_VehicleTypes", "cardinality(\"SupportedVehicleTypes\") > 0 AND \"SupportedVehicleTypes\" <@ ARRAY[0,1,2] AND array_position(\"SupportedVehicleTypes\", NULL) IS NULL");
            t.HasCheckConstraint("CK_Slots_Dimensions", "(\"WidthMeters\" IS NULL OR \"WidthMeters\" > 0) AND (\"LengthMeters\" IS NULL OR \"LengthMeters\" > 0) AND (\"DistanceToExitMeters\" IS NULL OR \"DistanceToExitMeters\" >= 0)");
        });
        m.Entity<SlotFeature>().HasIndex(x => x.Code).IsUnique();
        m.Entity<ParkingSlotFeature>().HasIndex(x => new { x.ParkingSlotId, x.SlotFeatureId }).IsUnique();
        m.Entity<EntranceExit>().HasIndex(x => new { x.ParkingLotId, x.Code }).IsUnique();
        m.Entity<OperatingHours>().HasIndex(x => new { x.ParkingLotId, x.DayOfWeek }).IsUnique();
        m.Entity<OperatingHours>().ToTable(t => t.HasCheckConstraint("CK_Hours_Interval", "((\"IsClosed\" <> \"IsOpen24Hours\") AND \"OpensAt\" IS NULL AND \"ClosesAt\" IS NULL AND NOT \"ClosesNextDay\") OR (NOT \"IsClosed\" AND NOT \"IsOpen24Hours\" AND \"OpensAt\" IS NOT NULL AND \"ClosesAt\" IS NOT NULL AND ((NOT \"ClosesNextDay\" AND \"OpensAt\" < \"ClosesAt\") OR (\"ClosesNextDay\" AND \"ClosesAt\" < \"OpensAt\")))"));
        var policy = m.Entity<ParkingPolicy>();
        policy.HasOne(x => x.ParkingLot).WithOne(x => x.Policy).HasForeignKey<ParkingPolicy>(x => x.ParkingLotId);
        policy.ToTable(t => {
            t.HasCheckConstraint("CK_Policy_Durations", "\"PaymentHoldMinutes\" > 0 AND \"MinimumBookingMinutes\" > 0 AND \"MaximumBookingMinutes\" >= \"MinimumBookingMinutes\"");
            t.HasCheckConstraint("CK_Policy_OptionalWindows", "(\"EarlyArrivalMinutes\" IS NULL OR \"EarlyArrivalMinutes\" >= 0) AND (\"LateArrivalMinutes\" IS NULL OR \"LateArrivalMinutes\" >= 0) AND (\"QrLifetimeMinutes\" IS NULL OR \"QrLifetimeMinutes\" > 0) AND (\"ExitGraceMinutes\" IS NULL OR \"ExitGraceMinutes\" >= 0)");
            t.HasCheckConstraint("CK_Policy_Refund", "(\"CancellationRefundCutoffMinutes\" IS NULL AND \"CancellationRefundPercent\" IS NULL) OR (\"CancellationRefundCutoffMinutes\" IS NOT NULL AND \"CancellationRefundCutoffMinutes\" >= 0 AND \"CancellationRefundPercent\" IS NOT NULL AND \"CancellationRefundPercent\" BETWEEN 0 AND 100)");
        });
        var map = m.Entity<MapVersion>();
        map.HasAlternateKey(x => new { x.Id, x.ParkingLotId });
        map.HasIndex(x => new { x.ParkingLotId, x.VersionNumber }).IsUnique();
        map.HasIndex(x => x.ParkingLotId).IsUnique().HasFilter("\"Status\" = 1");
        map.ToTable(t => t.HasCheckConstraint("CK_MapVersions_Number", "\"VersionNumber\" > 0"));
        var obj = m.Entity<MapObject>();
        obj.HasOne(x => x.MapVersion).WithMany(x => x.Objects).HasForeignKey(x => new { x.MapVersionId, x.ParkingLotId }).HasPrincipalKey(x => new { x.Id, x.ParkingLotId });
        obj.HasOne(x => x.ParkingSlot).WithMany().HasForeignKey(x => new { x.ParkingSlotId, x.ParkingLotId }).HasPrincipalKey(x => new { x.Id, x.ParkingLotId });
        obj.HasOne(x => x.ParkingLevel).WithMany().HasForeignKey(x => new { x.ParkingLevelId, x.ParkingLotId }).HasPrincipalKey(x => new { x.Id, x.ParkingLotId });
        obj.HasIndex(x => new { x.MapVersionId, x.ParkingSlotId }).IsUnique().HasFilter("\"ParkingSlotId\" IS NOT NULL");
        obj.ToTable(t => {
            t.HasCheckConstraint("CK_MapObjects_Slot", "(\"ObjectType\" = 0) = (\"ParkingSlotId\" IS NOT NULL)");
            t.HasCheckConstraint("CK_MapObjects_Scale", "\"ScaleX\" > 0 AND \"ScaleY\" > 0 AND \"ScaleZ\" > 0");
        });
    }
}
