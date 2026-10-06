using ParkingSystem.Domain.Common;

namespace ParkingSystem.Domain.Entities;

/// <summary>
/// Phiên hội thoại giữa người dùng và Trợ lý ảo AI Smart Parking
/// </summary>
public class ParkingAssistantSession : BaseEntity
{
    /// <summary>
    /// ID tài khoản người dùng (nếu đã đăng nhập) hoặc Guest Identifier
    /// </summary>
    public string? UserId { get; set; }

    /// <summary>
    /// Tiêu đề hoặc tóm tắt chủ đề hội thoại
    /// </summary>
    public string Title { get; set; } = "Cuộc trò chuyện mới";

    /// <summary>
    /// Thời điểm diễn ra hoạt động gần nhất trong phiên
    /// </summary>
    public DateTimeOffset LastActivityAt { get; set; } = DateTimeOffset.UtcNow;

    /// <summary>
    /// Danh sách tin nhắn thuộc phiên hội thoại này
    /// </summary>
    public ICollection<ParkingAssistantMessage> Messages { get; set; } = new List<ParkingAssistantMessage>();
}
