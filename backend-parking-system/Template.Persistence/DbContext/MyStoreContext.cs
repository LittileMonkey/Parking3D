using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore;
using Template.Application.Common.Interface;
using Template.Domain;
using Template.Domain.Entities;

namespace Template.Persistence;

public partial class MyStoreContext : DbContext
{
    public MyStoreContext()
    {
    }

    public MyStoreContext(DbContextOptions<MyStoreContext> options)
        : base(options)
    {
    }

    public virtual DbSet<AccountMember> AccountMembers { get; set; }

    public virtual DbSet<Category> Categories { get; set; }

    public virtual DbSet<Product> Products { get; set; }
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<AccountMember>(entity =>
        {
            entity.HasKey(e => e.MemberId).HasName("PK__AccountM__0CF04B3865ED11E2");

            entity.ToTable("AccountMember");

            entity.HasIndex(e => e.EmailAddress, "UQ__AccountM__49A147406C0AC3B0").IsUnique();

            entity.Property(e => e.MemberId)
                .HasMaxLength(36)
                .HasColumnName("MemberID");
            entity.Property(e => e.EmailAddress).HasMaxLength(100);
            entity.Property(e => e.FullName).HasMaxLength(80);
            entity.Property(e => e.MemberPassword).HasMaxLength(80);
            entity.Property(e => e.MemberRole)
                .HasMaxLength(10)
                .IsUnicode(false)
                .HasDefaultValue("Active");
            entity.Property(e => e.Status)
                .HasMaxLength(50)
                .HasDefaultValue("Active");
        });

        modelBuilder.Entity<Category>(entity =>
        {
            entity.HasKey(e => e.CategoryId).HasName("PK__Categori__19093A2B034AB061");

            entity.Property(e => e.CategoryId).HasColumnName("CategoryID");
            entity.Property(e => e.CategoryName).HasMaxLength(15);
        });

        modelBuilder.Entity<Product>(entity =>
        {
            entity.HasKey(e => e.ProductId).HasName("PK__Products__B40CC6EDC42DAFF3");

            entity.Property(e => e.ProductId).HasColumnName("ProductID");
            entity.Property(e => e.CategoryId).HasColumnName("CategoryID");
            entity.Property(e => e.ProductName).HasMaxLength(40);
            entity.Property(e => e.UnitPrice).HasColumnType("money");

            entity.HasOne(d => d.Category).WithMany(p => p.Products)
                .HasForeignKey(d => d.CategoryId)
                .HasConstraintName("FK__Products__Catego__619B8048");
        });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
