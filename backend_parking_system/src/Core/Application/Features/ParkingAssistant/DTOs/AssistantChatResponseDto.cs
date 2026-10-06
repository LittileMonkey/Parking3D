namespace ParkingSystem.Application.Features.ParkingAssistant.DTOs;

/// <summary>
/// DTO phản hồi câu trả lời từ Trợ lý ảo AI
/// </summary>
public record AssistantChatResponseDto
{
    /// <summary>
    /// ID phiên trò chuyện (giữ nguyên để tiếp tục ngữ cảnh ở các câu tiếp theo)
    /// </summary>
    public Guid SessionId { get; init; }

    /// <summary>
    /// Nội dung câu trả lời của Trợ lý AI (đã tích hợp kiến thức nghiệp vụ bãi xe)
    /// </summary>
    public string ReplyMessage { get; init; } = string.Empty;

    /// <summary>
    /// Các câu hỏi gợi ý tiếp theo hoặc thao tác nhanh đề xuất cho người dùng
    /// </summary>
    public List<string> SuggestedActions { get; init; } = [];

    /// <summary>
    /// Thời điểm tạo câu trả lời
    /// </summary>
    public DateTimeOffset CreatedAt { get; init; } = DateTimeOffset.UtcNow;
}
