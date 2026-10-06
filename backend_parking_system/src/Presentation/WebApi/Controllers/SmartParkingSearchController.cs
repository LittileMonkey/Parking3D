using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using ParkingSystem.Application.Common.Interfaces;
using ParkingSystem.Application.Common.Models;
using ParkingSystem.Application.Features.ParkingSearch.DTOs;
using ParkingSystem.Application.Features.ParkingSearch.Queries;

namespace ParkingSystem.Presentation.WebApi.Controllers;

[ApiController]
[Route("api/v1/ai/parking")]
public class SmartParkingSearchController(IParkingSearchAiService searchAiService) : ControllerBase
{
    /// <summary>
    /// Tìm kiếm và gợi ý bãi xe thông minh bằng ngôn ngữ tự nhiên (NLP + Haversine + Pricing Calculation)
    /// </summary>
    /// <param name="query">Câu hỏi tìm kiếm của người dùng và tọa độ GPS hiện tại (nếu có)</param>
    /// <param name="ct">CancellationToken</param>
    /// <returns>Danh sách bãi xe tối ưu kèm lời giải thích từ AI</returns>
    [HttpPost("smart-search")]
    [ProducesResponseType(typeof(ApiResponse<ParkingRecommendationDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<ParkingRecommendationDto>), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> SmartSearch(
        [FromBody] SearchParkingSmartQuery query,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(query.NaturalLanguagePrompt))
        {
            return BadRequest(ApiResponse<ParkingRecommendationDto>.Failure(
                "Nội dung tìm kiếm 'naturalLanguagePrompt' không được để trống.", 400));
        }

        var result = await searchAiService.SmartSearchAsync(
            query.NaturalLanguagePrompt,
            query.UserCurrentLatitude,
            query.UserCurrentLongitude,
            ct);

        return Ok(ApiResponse<ParkingRecommendationDto>.Success(
            result, "Tìm kiếm và phân tích bãi xe thông minh thành công.", 200));
    }
}
