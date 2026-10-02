using Microsoft.EntityFrameworkCore;
using ParkingSystem.Models;

namespace ParkingSystem.Data;

public sealed partial class ParkingDbContext
{
    private static void ConfigureOperations(ModelBuilder m)
    {
        m.Entity<AuditLog>().HasIndex(x => new { x.ParkingLotId, x.CreatedAt });
        m.Entity<Notification>().HasIndex(x => new { x.UserId, x.ReadAt });
        m.Entity<CameraEvent>().HasIndex(x => new { x.ParkingLotId, x.CameraId, x.ExternalEventId }).IsUnique();
        m.Entity<CameraEvent>().HasOne(x => x.ParkingSlot).WithMany().HasForeignKey(x => new { x.ParkingSlotId, x.ParkingLotId }).HasPrincipalKey(x => new { x.Id, x.ParkingLotId });
        m.Entity<CameraEvent>().HasAlternateKey(x => new { x.Id, x.ParkingLotId });
        m.Entity<CameraEvent>().ToTable(t => t.HasCheckConstraint("CK_Camera_Confidence", "\"Confidence\" IS NULL OR \"Confidence\" BETWEEN 0 AND 1"));
        var issue = m.Entity<ParkingIssue>();
        issue.HasOne(x => x.ReportedByUser).WithMany().HasForeignKey(x => x.ReportedByUserId);
        issue.HasOne(x => x.ResolvedByUser).WithMany().HasForeignKey(x => x.ResolvedByUserId);
        issue.HasOne(x => x.Booking).WithMany().HasForeignKey(x => new { x.BookingId, x.ParkingLotId }).HasPrincipalKey(x => new { x.Id, x.ParkingLotId });
        issue.HasOne(x => x.ParkingSession).WithMany().HasForeignKey(x => new { x.ParkingSessionId, x.ParkingLotId }).HasPrincipalKey(x => new { x.Id, x.ParkingLotId });
        issue.HasOne(x => x.CameraEvent).WithMany().HasForeignKey(x => new { x.CameraEventId, x.ParkingLotId }).HasPrincipalKey(x => new { x.Id, x.ParkingLotId });
    }
}
