using Microsoft.EntityFrameworkCore;
using ParkingSystem.Models;

namespace ParkingSystem.Data;

public sealed partial class ParkingDbContext
{
    private static void ConfigureFinance(ModelBuilder m)
    {
        var plan = m.Entity<PricingPlan>();
        plan.HasAlternateKey(x => new { x.Id, x.ParkingLotId });
        plan.HasIndex(x => new { x.ParkingLotId, x.VersionNumber }).IsUnique();
        plan.ToTable(t => t.HasCheckConstraint("CK_Plans_Period", "\"VersionNumber\" > 0 AND (\"EffectiveTo\" IS NULL OR \"EffectiveTo\" > \"EffectiveFrom\")"));
        var rule = m.Entity<PricingRule>();
        rule.HasOne(x => x.PricingPlan).WithMany(x => x.Rules).HasForeignKey(x => new { x.PricingPlanId, x.ParkingLotId }).HasPrincipalKey(x => new { x.Id, x.ParkingLotId });
        rule.HasOne(x => x.Zone).WithMany().HasForeignKey(x => new { x.ZoneId, x.ParkingLotId }).HasPrincipalKey(x => new { x.Id, x.ParkingLotId });
        rule.ToTable(t => t.HasCheckConstraint("CK_Rules_Json", "jsonb_typeof(\"ParametersJson\") = 'object'"));
        var snapshot = m.Entity<PricingSnapshot>();
        snapshot.HasOne(x => x.PricingPlan).WithMany().HasForeignKey(x => new { x.PricingPlanId, x.ParkingLotId }).HasPrincipalKey(x => new { x.Id, x.ParkingLotId });
        snapshot.HasOne(x => x.Booking).WithOne(x => x.PricingSnapshot).HasForeignKey<PricingSnapshot>(x => new { x.BookingId, x.ParkingLotId }).HasPrincipalKey<Booking>(x => new { x.Id, x.ParkingLotId });
        snapshot.HasOne(x => x.ParkingSession).WithOne(x => x.PricingSnapshot).HasForeignKey<PricingSnapshot>(x => new { x.ParkingSessionId, x.ParkingLotId }).HasPrincipalKey<ParkingSession>(x => new { x.Id, x.ParkingLotId });
        snapshot.ToTable(t => t.HasCheckConstraint("CK_Snapshots_Owner", "\"BookingId\" IS NOT NULL OR \"ParkingSessionId\" IS NOT NULL"));
        var payment = m.Entity<Payment>();
        payment.HasIndex(x => x.IdempotencyKey).IsUnique();
        payment.ToTable(t => {
            t.HasCheckConstraint("CK_Payments_Owner", "(\"BookingId\" IS NULL) <> (\"ParkingSessionId\" IS NULL)");
            t.HasCheckConstraint("CK_Payments_Amount", "\"Amount\" >= 0");
            t.HasCheckConstraint("CK_Payments_Cash", "\"Method\" <> 1 OR \"Status\" NOT IN (1,3,4) OR \"CashConfirmedByUserId\" IS NOT NULL");
        });
        var transaction = m.Entity<PaymentTransaction>();
        transaction.HasIndex(x => new { x.Provider, x.ProviderReference }).IsUnique().HasFilter("\"ProviderReference\" IS NOT NULL");
        transaction.HasIndex(x => new { x.Provider, x.EventKey }).IsUnique().HasFilter("\"EventKey\" IS NOT NULL");
        transaction.HasIndex(x => new { x.Provider, x.RequestReference }).IsUnique();
        transaction.ToTable(t => t.HasCheckConstraint("CK_Transactions_Amount", "\"Amount\" >= 0"));
    }
}
