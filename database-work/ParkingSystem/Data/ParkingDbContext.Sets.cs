using Microsoft.EntityFrameworkCore;
using ParkingSystem.Models;
namespace ParkingSystem.Data;
public sealed partial class ParkingDbContext
{
    public DbSet<Booking> Bookings => Set<Booking>();
    public DbSet<ParkingSession> ParkingSessions => Set<ParkingSession>();
    public DbSet<QRToken> QRTokens => Set<QRToken>();
    public DbSet<SlotReservation> SlotReservations => Set<SlotReservation>();
    public DbSet<FacilityStaffAssignment> StaffAssignments => Set<FacilityStaffAssignment>();
    public DbSet<OtpChallenge> OtpChallenges => Set<OtpChallenge>();
    public DbSet<User> Users => Set<User>();
    public DbSet<Vehicle> Vehicles => Set<Vehicle>();
    public DbSet<MapObject> MapObjects => Set<MapObject>();
    public DbSet<MapVersion> MapVersions => Set<MapVersion>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<CameraEvent> CameraEvents => Set<CameraEvent>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<ParkingIssue> ParkingIssues => Set<ParkingIssue>();
    public DbSet<EntranceExit> EntranceExits => Set<EntranceExit>();
    public DbSet<OperatingHours> OperatingHours => Set<OperatingHours>();
    public DbSet<ParkingLevel> ParkingLevels => Set<ParkingLevel>();
    public DbSet<ParkingLot> ParkingLots => Set<ParkingLot>();
    public DbSet<ParkingPolicy> ParkingPolicies => Set<ParkingPolicy>();
    public DbSet<ParkingSlot> ParkingSlots => Set<ParkingSlot>();
    public DbSet<ParkingSlotFeature> ParkingSlotFeatures => Set<ParkingSlotFeature>();
    public DbSet<SlotFeature> SlotFeatures => Set<SlotFeature>();
    public DbSet<Zone> Zones => Set<Zone>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<PaymentTransaction> PaymentTransactions => Set<PaymentTransaction>();
    public DbSet<PricingPlan> PricingPlans => Set<PricingPlan>();
    public DbSet<PricingRule> PricingRules => Set<PricingRule>();
    public DbSet<PricingSnapshot> PricingSnapshots => Set<PricingSnapshot>();
}
