using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using ParkingSystem.Application.Common.Interfaces;
using ParkingSystem.Application.Common.Models;
using ParkingSystem.Application.Features.ParkingAssistant.DTOs;

namespace ParkingSystem.Presentation.WebApi.Controllers;

[ApiController]
[Route("api/v1/ai/assistant")]
public class ParkingAssistantController(IParkingAssistantService assistantService) : ControllerBase
{
    /// <summary>
    /// Gửi tin nhắn hỏi đáp với Trợ lý ảo AI Smart Parking
    /// </summary>
    /// <param name="request">Thông tin câu hỏi và ID phiên hội thoại</param>
    /// <param name="ct">CancellationToken</param>
    /// <returns>Câu trả lời của AI kèm gợi ý các hành động tiếp theo</returns>
    [HttpPost("chat")]
    [ProducesResponseType(typeof(ApiResponse<AssistantChatResponseDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<AssistantChatResponseDto>), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Chat(
        [FromBody] AssistantChatRequestDto request,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Message))
        {
            return BadRequest(ApiResponse<AssistantChatResponseDto>.Failure(
                "Nội dung tin nhắn 'message' không được để trống.", 400));
        }

        var result = await assistantService.ChatAsync(request, ct);

        return Ok(ApiResponse<AssistantChatResponseDto>.Success(
            result, "Trợ lý AI đã trả lời thành công.", 200));
    }

    /// <summary>
    /// Đặt lại / Xóa lịch sử phiên trò chuyện hiện tại
    /// </summary>
    /// <param name="sessionId">Mã định danh phiên</param>
    /// <param name="ct">CancellationToken</param>
    /// <returns>Trạng thái thành công</returns>
    [HttpDelete("session/{sessionId:guid}")]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ResetSession(
        [FromRoute] Guid sessionId,
        CancellationToken ct)
    {
        var success = await assistantService.ResetSessionAsync(sessionId, ct);

        return Ok(ApiResponse<bool>.Success(
            success, success ? "Đã làm mới phiên hội thoại thành công." : "Phiên hội thoại không tồn tại.", 200));
    }
}
