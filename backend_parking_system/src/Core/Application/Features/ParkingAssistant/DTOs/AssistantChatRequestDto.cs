namespace ParkingSystem.Application.Features.ParkingAssistant.DTOs;

/// <summary>
/// DTO gửi tin nhắn trò chuyện với Trợ lý ảo AI
/// </summary>
public record AssistantChatRequestDto
{
    /// <summary>
    /// ID phiên trò chuyện hiện tại (nếu là cuộc trò chuyện tiếp diễn)
    /// </summary>
    public Guid? SessionId { get; init; }

    /// <summary>
    /// Mã người dùng gửi câu hỏi (nếu đã đăng nhập)
    /// </summary>
    public string? UserId { get; init; }

    /// <summary>
    /// Nội dung tin nhắn người dùng nhập vào
    /// </summary>
    public string Message { get; init; } = string.Empty;

    /// <summary>
    /// Mã bãi đỗ xe người dùng đang quan tâm hoặc đang gửi xe (nếu có)
    /// </summary>
    public Guid? CurrentParkingLotId { get; init; }
}
