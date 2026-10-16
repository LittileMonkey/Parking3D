using Parking.AI.Application.DTOs.ParkingSearch;

namespace Parking.AI.Application.Interfaces;

/// <summary>
/// Giao diện dịch vụ tìm kiếm bãi xe thông minh bằng NLP & GenAI (Google Gemini / Local LLM)
/// </summary>
public interface IParkingSearchAiService
{
    /// <summary>
    /// Sử dụng LLM phân tích câu hỏi tự nhiên của người dùng thành tiêu chí tìm kiếm có cấu trúc
    /// </summary>
    Task<SmartSearchCriteriaDto> ParseSearchIntentAsync(string naturalLanguagePrompt, CancellationToken cancellationToken = default);

    /// <summary>
    /// Đưa ra danh sách gợi ý bãi xe tối ưu nhất dựa trên tiêu chí tìm kiếm đã phân tích (Nearest / Cheapest)
    /// </summary>
    Task<ParkingRecommendationDto> RecommendParkingAsync(SmartSearchCriteriaDto criteria, CancellationToken cancellationToken = default);

    /// <summary>
    /// Xử lý end-to-end: Nhận câu hỏi tự nhiên -> Phân tích tiêu chí -> Trả về danh sách gợi ý
    /// </summary>
    Task<ParkingRecommendationDto> SmartSearchAsync(string naturalLanguagePrompt, double? userLatitude = null, double? userLongitude = null, CancellationToken cancellationToken = default);
}
