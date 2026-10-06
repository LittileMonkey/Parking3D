namespace ParkingSystem.Domain.Common;

/// <summary>
/// Lớp thực thể cơ sở (Base Entity) theo chuẩn Clean Architecture
/// </summary>
public abstract class BaseEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? UpdatedAt { get; set; }
}
