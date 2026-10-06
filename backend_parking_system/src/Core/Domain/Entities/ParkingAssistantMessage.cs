using ParkingSystem.Domain.Common;

namespace ParkingSystem.Domain.Entities;

/// <summary>
/// Tin nhắn chi tiết trong phiên hội thoại AI
/// </summary>
public class ParkingAssistantMessage : BaseEntity
{
    /// <summary>
    /// ID phiên chat liên kết
    /// </summary>
    public Guid SessionId { get; set; }

    /// <summary>
    /// Thực thể Session liên kết
    /// </summary>
    public ParkingAssistantSession? Session { get; set; }

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
