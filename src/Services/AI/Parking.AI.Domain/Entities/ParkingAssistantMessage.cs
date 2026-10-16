namespace Parking.AI.Domain.Entities;

/// <summary>
/// Tin nhắn chi tiết trong phiên hội thoại AI
/// </summary>
public class ParkingAssistantMessage
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? UpdatedAt { get; set; }

    /// <summary>
    /// ID phiên chat liên kết
    /// </summary>
    public Guid SessionId { get; set; }

    /// <summary>
    /// Vai trò người phát biểu: "user", "assistant", hoặc "system"
    /// </summary>
    public string Role { get; set; } = "user";

    /// <summary>
    /// Nội dung tin nhắn
    /// </summary>
    public string Content { get; set; } = string.Empty;

    /// <summary>
    /// Siêu dữ liệu mở rộng (Function calls, intent tags, suggestions dạng JSON)
    /// </summary>
    public string? MetadataJson { get; set; }
}
