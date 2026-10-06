using ParkingSystem.Application.Features.ParkingAssistant.DTOs;

namespace ParkingSystem.Application.Features.ParkingAssistant.Commands;

/// <summary>
/// Command gửi câu hỏi tới AI Assistant kèm ngữ cảnh
/// </summary>
public record SendAssistantPromptCommand(
    Guid? SessionId,
    string? UserId,
    string Message,
    Guid? CurrentParkingLotId)
{
    public static SendAssistantPromptCommand FromDto(AssistantChatRequestDto dto) =>
        new(dto.SessionId, dto.UserId, dto.Message, dto.CurrentParkingLotId);
}
