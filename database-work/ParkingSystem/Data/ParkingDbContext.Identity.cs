using Microsoft.EntityFrameworkCore;
using ParkingSystem.Models;

namespace ParkingSystem.Data;

public sealed partial class ParkingDbContext
{
    private static void ConfigureIdentity(ModelBuilder m)
    {
        var user = m.Entity<User>();
        user.HasIndex(x => x.Email).IsUnique().HasFilter("\"Email\" IS NOT NULL");
        user.HasIndex(x => x.PhoneNumber).IsUnique().HasFilter("\"PhoneNumber\" IS NOT NULL");
        user.ToTable(t => t.HasCheckConstraint("CK_Users_Login", "\"Email\" IS NOT NULL OR \"PhoneNumber\" IS NOT NULL"));
        var vehicle = m.Entity<Vehicle>();
        vehicle.HasOne(x => x.OwnerUser).WithMany(x => x.Vehicles).HasForeignKey(x => x.OwnerUserId);
        vehicle.HasIndex(x => x.NormalizedPlate).IsUnique().HasFilter("\"IsActive\"");
        vehicle.HasIndex(x => x.OwnerUserId).IsUnique().HasFilter("\"IsActive\" AND \"IsPrimary\" AND \"OwnerUserId\" IS NOT NULL");

        var assignment = m.Entity<FacilityStaffAssignment>();
        assignment.HasOne(x => x.User).WithMany(x => x.StaffAssignments).HasForeignKey(x => x.UserId);
        assignment.HasOne(x => x.AssignedByUser).WithMany().HasForeignKey(x => x.AssignedByUserId);
        assignment.HasIndex(x => new { x.ParkingLotId, x.UserId });
        assignment.ToTable(t => {
            t.HasCheckConstraint("CK_Assignments_Period", "\"ActiveTo\" IS NULL OR \"ActiveTo\" > \"ActiveFrom\"");
            t.HasCheckConstraint("CK_Assignments_Delegation", "NOT \"CanManageStaffAssignments\" OR \"Role\" = 1");
        });
        m.Entity<OtpChallenge>().HasIndex(x => new { x.PhoneNumber, x.Purpose, x.CreatedAt });
        m.Entity<OtpChallenge>().ToTable(t => {
            t.HasCheckConstraint("CK_Otp_Attempts", "\"MaxAttempts\" > 0 AND \"FailedAttempts\" BETWEEN 0 AND \"MaxAttempts\"");
            t.HasCheckConstraint("CK_Otp_Expiry", "\"ExpiresAt\" > \"CreatedAt\"");
            t.HasCheckConstraint("CK_Otp_Consumption", "\"ConsumedAt\" IS NULL OR (\"VerifiedAt\" IS NOT NULL AND \"ConsumedAt\" >= \"VerifiedAt\")");
        });
    }
}
