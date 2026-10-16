using Parking.AI.Application.DTOs.Assistant;

namespace Parking.AI.Application.Interfaces;

/// <summary>
/// Giao diện dịch vụ Trợ lý ảo AI Smart Parking (Hỏi đáp chính sách, giá vé, PCCC, tra cứu bãi)
/// </summary>
public interface IParkingAssistantService
{
    /// <summary>
    /// Gửi tin nhắn trò chuyện với Trợ lý AI và nhận câu trả lời thông minh
    /// </summary>
    Task<AssistantChatResponseDto> ChatAsync(AssistantChatRequestDto request, CancellationToken cancellationToken = default);

    /// <summary>
    /// Xóa hoặc đặt lại lịch sử phiên trò chuyện
    /// </summary>
    Task<bool> ResetSessionAsync(Guid sessionId, CancellationToken cancellationToken = default);
}
