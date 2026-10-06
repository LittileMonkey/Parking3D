using ParkingSystem.Application.Features.ParkingAssistant.DTOs;

namespace ParkingSystem.Application.Common.Interfaces;

/// <summary>
/// Giao diện dịch vụ Trợ lý ảo AI Smart Parking (Hỏi đáp chính sách, giá vé, PCCC, tra cứu bãi)
/// </summary>
public interface IParkingAssistantService
{
    /// <summary>
    /// Gửi tin nhắn trò chuyện với Trợ lý AI và nhận câu trả lời thông minh
    /// </summary>
    /// <param name="request">Thông tin tin nhắn và ngữ cảnh phiên</param>
    /// <param name="cancellationToken">Hủy thao tác</param>
    /// <returns>Câu trả lời của trợ lý kèm các hành động gợi ý tiếp theo</returns>
    Task<AssistantChatResponseDto> ChatAsync(AssistantChatRequestDto request, CancellationToken cancellationToken = default);

    /// <summary>
    /// Xóa hoặc đặt lại lịch sử phiên trò chuyện
    /// </summary>
    Task<bool> ResetSessionAsync(Guid sessionId, CancellationToken cancellationToken = default);
}
