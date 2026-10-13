using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore;
using Parking.Identity.Domain.Entities;

namespace Parking.Identity.Persistence.DataAccessLayer;

public partial class ParkingDatabaseV4Context : DbContext
{
    public ParkingDatabaseV4Context()
    {
    }

    public ParkingDatabaseV4Context(DbContextOptions<ParkingDatabaseV4Context> options)
        : base(options)
    {
    }

    public virtual DbSet<AppUser> AppUsers { get; set; }

    public virtual DbSet<AuditLog> AuditLogs { get; set; }

    public virtual DbSet<AuthToken> AuthTokens { get; set; }

    public virtual DbSet<IntegrationInbox> IntegrationInboxes { get; set; }

    public virtual DbSet<IntegrationOutbox> IntegrationOutboxes { get; set; }

    public virtual DbSet<LotStaffAssignment> LotStaffAssignments { get; set; }

    public virtual DbSet<PlatformUserRole> PlatformUserRoles { get; set; }

    public virtual DbSet<ServiceSchemaVersion> ServiceSchemaVersions { get; set; }
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder
            .HasPostgresEnum("booking_mode", new[] { "EXACT_SLOT", "AUTO_SLOT" })
            .HasPostgresEnum("booking_status", new[] { "PENDING_PAYMENT", "CONFIRMED", "CHECKED_IN", "COMPLETED", "CANCELLED", "EXPIRED", "NO_SHOW" })
            .HasPostgresEnum("map_version_status", new[] { "DRAFT", "PUBLISHED", "ARCHIVED" })
            .HasPostgresEnum("payment_method", new[] { "VNPAY", "CASH" })
            .HasPostgresEnum("payment_status", new[] { "PENDING", "SUCCESS", "FAILED", "PARTIALLY_REFUNDED", "REFUNDED" })
            .HasPostgresEnum("reservation_status", new[] { "HELD", "CONFIRMED", "RELEASED" })
            .HasPostgresEnum("session_status", new[] { "ACTIVE", "EXIT_PENDING", "COMPLETED" })
            .HasPostgresEnum("slot_operational_status", new[] { "ACTIVE", "MAINTENANCE", "DISABLED" })
            .HasPostgresExtension("btree_gist");

        modelBuilder.Entity<AppUser>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("app_users_pkey");

            entity.ToTable("app_users");

            entity.HasIndex(e => e.EmailNormalized, "app_users_email_normalized_key").IsUnique();

            entity.HasIndex(e => e.PhoneE164, "app_users_phone_e164_key").IsUnique();

            entity.Property(e => e.Id)
                .HasDefaultValueSql("gen_random_uuid()")
                .HasColumnName("id");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("created_at");
            entity.Property(e => e.EmailNormalized).HasColumnName("email_normalized");
            entity.Property(e => e.EmailVerifiedAt).HasColumnName("email_verified_at");
            entity.Property(e => e.FullName)
                .HasMaxLength(200)
                .HasColumnName("full_name");
            entity.Property(e => e.LockedUntil).HasColumnName("locked_until");
            entity.Property(e => e.PasswordHash).HasColumnName("password_hash");
            entity.Property(e => e.PhoneE164)
                .HasMaxLength(20)
                .HasColumnName("phone_e164");
            entity.Property(e => e.PhoneVerifiedAt).HasColumnName("phone_verified_at");
            entity.Property(e => e.Status).HasColumnName("status");
            entity.Property(e => e.UpdatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("updated_at");
        });

        modelBuilder.Entity<AuditLog>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("audit_logs_pkey");

            entity.ToTable("audit_logs");

            entity.Property(e => e.Id)
                .HasDefaultValueSql("gen_random_uuid()")
                .HasColumnName("id");
            entity.Property(e => e.Action).HasColumnName("action");
            entity.Property(e => e.ActorType).HasColumnName("actor_type");
            entity.Property(e => e.ActorUserId).HasColumnName("actor_user_id");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("created_at");
            entity.Property(e => e.EntityId).HasColumnName("entity_id");
            entity.Property(e => e.EntityType).HasColumnName("entity_type");
            entity.Property(e => e.LotId).HasColumnName("lot_id");
            entity.Property(e => e.NewValues)
                .HasColumnType("jsonb")
                .HasColumnName("new_values");
            entity.Property(e => e.OldValues)
                .HasColumnType("jsonb")
                .HasColumnName("old_values");
            entity.Property(e => e.Reason).HasColumnName("reason");
            entity.Property(e => e.RequestId).HasColumnName("request_id");
        });

        modelBuilder.Entity<AuthToken>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("auth_tokens_pkey");

            entity.ToTable("auth_tokens");

            entity.HasIndex(e => e.TokenHash, "auth_tokens_token_hash_key").IsUnique();

            entity.Property(e => e.Id)
                .HasDefaultValueSql("gen_random_uuid()")
                .HasColumnName("id");
            entity.Property(e => e.ConsumedAt).HasColumnName("consumed_at");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("created_at");
            entity.Property(e => e.ExpiresAt).HasColumnName("expires_at");
            entity.Property(e => e.FamilyId).HasColumnName("family_id");
            entity.Property(e => e.Purpose).HasColumnName("purpose");
            entity.Property(e => e.RevokedAt).HasColumnName("revoked_at");
            entity.Property(e => e.TokenHash).HasColumnName("token_hash");
            entity.Property(e => e.UserId).HasColumnName("user_id");

            entity.HasOne(d => d.User).WithMany(p => p.AuthTokens)
                .HasForeignKey(d => d.UserId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("fk_core_004");
        });

        modelBuilder.Entity<IntegrationInbox>(entity =>
        {
            entity.HasKey(e => e.EventId).HasName("integration_inbox_pkey");

            entity.ToTable("integration_inbox");

            entity.Property(e => e.EventId)
                .ValueGeneratedNever()
                .HasColumnName("event_id");
            entity.Property(e => e.EventType).HasColumnName("event_type");
            entity.Property(e => e.Outcome).HasColumnName("outcome");
            entity.Property(e => e.PayloadHash).HasColumnName("payload_hash");
            entity.Property(e => e.ReceivedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("received_at");
        });

        modelBuilder.Entity<IntegrationOutbox>(entity =>
        {
            entity.HasKey(e => e.EventId).HasName("integration_outbox_pkey");

            entity.ToTable("integration_outbox");

            entity.HasIndex(e => new { e.NextAttemptAt, e.OccurredAt }, "ix_outbox_pending").HasFilter("(delivered_at IS NULL)");

            entity.Property(e => e.EventId)
                .HasDefaultValueSql("gen_random_uuid()")
                .HasColumnName("event_id");
            entity.Property(e => e.AggregateId).HasColumnName("aggregate_id");
            entity.Property(e => e.Attempts)
                .HasDefaultValue(0)
                .HasColumnName("attempts");
            entity.Property(e => e.DeliveredAt).HasColumnName("delivered_at");
            entity.Property(e => e.EventType).HasColumnName("event_type");
            entity.Property(e => e.LastError).HasColumnName("last_error");
            entity.Property(e => e.NextAttemptAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("next_attempt_at");
            entity.Property(e => e.OccurredAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("occurred_at");
            entity.Property(e => e.Payload)
                .HasColumnType("jsonb")
                .HasColumnName("payload");
        });

        modelBuilder.Entity<LotStaffAssignment>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("lot_staff_assignments_pkey");

            entity.ToTable("lot_staff_assignments");

            entity.Property(e => e.Id)
                .HasDefaultValueSql("gen_random_uuid()")
                .HasColumnName("id");
            entity.Property(e => e.CanManageStaffAssignments)
                .HasDefaultValue(false)
                .HasColumnName("can_manage_staff_assignments");
            entity.Property(e => e.LotId).HasColumnName("lot_id");
            entity.Property(e => e.RevokedAt).HasColumnName("revoked_at");
            entity.Property(e => e.RoleCode).HasColumnName("role_code");
            entity.Property(e => e.UserId).HasColumnName("user_id");
            entity.Property(e => e.ValidFrom).HasColumnName("valid_from");
            entity.Property(e => e.ValidUntil).HasColumnName("valid_until");

            entity.HasOne(d => d.User).WithMany(p => p.LotStaffAssignments)
                .HasForeignKey(d => d.UserId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("fk_core_022");
        });

        modelBuilder.Entity<PlatformUserRole>(entity =>
        {
            entity.HasKey(e => new { e.UserId, e.RoleCode }).HasName("platform_user_roles_pkey");

            entity.ToTable("platform_user_roles");

            entity.Property(e => e.UserId).HasColumnName("user_id");
            entity.Property(e => e.RoleCode).HasColumnName("role_code");

            entity.HasOne(d => d.User).WithMany(p => p.PlatformUserRoles)
                .HasForeignKey(d => d.UserId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("fk_core_056");
        });

        modelBuilder.Entity<ServiceSchemaVersion>(entity =>
        {
            entity.HasKey(e => e.Version).HasName("service_schema_versions_pkey");

            entity.ToTable("service_schema_versions");

            entity.Property(e => e.Version)
                .ValueGeneratedNever()
                .HasColumnName("version");
            entity.Property(e => e.AppliedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("applied_at");
        });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
