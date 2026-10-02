using Microsoft.EntityFrameworkCore;
using ParkingSystem.Models;

namespace ParkingSystem.Data;

public sealed partial class ParkingDbContext(DbContextOptions<ParkingDbContext> options) : DbContext(options)
{
    protected override void OnModelCreating(ModelBuilder model)
    {
        ConfigureIdentity(model);
        ConfigureParking(model);
        ConfigureBookings(model);
        ConfigureFinance(model);
        ConfigureOperations(model);
        model.HasPostgresExtension("btree_gist");

        // Entity is a CLR convenience, not a database inheritance hierarchy.
        foreach (var entity in model.Model.GetEntityTypes().ToList())
        {
            var builder = model.Entity(entity.ClrType);
            builder.HasBaseType((Type?)null);
            builder.HasKey(nameof(Entity.Id));
            builder.Property(nameof(Entity.Id)).HasDefaultValueSql("gen_random_uuid()");
            builder.Property(nameof(Entity.CreatedAt)).HasDefaultValueSql("now()");
            foreach (var property in entity.GetProperties().ToList())
            {
                var type = Nullable.GetUnderlyingType(property.ClrType) ?? property.ClrType;
                if (type.IsEnum)
                {
                    var values = string.Join(",", Enum.GetValues(type).Cast<object>().Select(Convert.ToInt32));
                    builder.ToTable(t => t.HasCheckConstraint($"CK_{entity.GetTableName()}_{property.Name}", $"\"{property.Name}\" IN ({values})"));
                }
                if (type == typeof(decimal)) builder.Property(property.Name).HasPrecision(18, 2);
                if (property.Name == "Version")
                    builder.ToTable(t => t.HasCheckConstraint($"CK_{entity.GetTableName()}_Version", "\"Version\" > 0"));
            }
        }
        foreach (var fk in model.Model.GetEntityTypes().SelectMany(e => e.GetForeignKeys()))
            fk.DeleteBehavior = DeleteBehavior.Restrict;
    }

    private void PrepareChanges()
    {
        ChangeTracker.DetectChanges();
        foreach (var entry in ChangeTracker.Entries<Entity>())
        {
            if (entry.Entity is AuditLog && entry.State is EntityState.Modified or EntityState.Deleted)
                throw new InvalidOperationException("Audit logs are append-only.");
            if (entry.State == EntityState.Modified)
            {
                entry.Entity.UpdatedAt = DateTimeOffset.UtcNow;
                entry.Property(x => x.CreatedAt).IsModified = false;
                var version = entry.Metadata.FindProperty("Version");
                if (version is not null)
                    entry.Property("Version").CurrentValue = checked((long)entry.Property("Version").OriginalValue! + 1);
            }
        }
    }

    public override int SaveChanges(bool acceptAllChangesOnSuccess)
    {
        PrepareChanges();
        return base.SaveChanges(acceptAllChangesOnSuccess);
    }

    public override Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
    {
        PrepareChanges();
        return base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
    }
}
