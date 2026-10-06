using ParkingSystem.Application.Features.ParkingSearch.DTOs;

namespace ParkingSystem.Application.Common.Interfaces;

/// <summary>
/// Giao diện dịch vụ tìm kiếm bãi xe thông minh bằng NLP & GenAI (Google Gemini / Local LLM)
/// </summary>
public interface IParkingSearchAiService
{
    /// <summary>
    /// Sử dụng LLM phân tích câu hỏi tự nhiên của người dùng thành tiêu chí tìm kiếm có cấu trúc
    /// </summary>
    /// <param name="naturalLanguagePrompt">Câu hỏi người dùng nhập (VD: "Tìm bãi đỗ ô tô gần Landmark 81 dưới 20k/h")</param>
    /// <param name="cancellationToken">Hủy thao tác</param>
    /// <returns>Đối tượng tiêu chí SmartSearchCriteriaDto đã được bóc tách</returns>
    Task<SmartSearchCriteriaDto> ParseSearchIntentAsync(string naturalLanguagePrompt, CancellationToken cancellationToken = default);

    /// <summary>
    /// Đưa ra danh sách gợi ý bãi xe tối ưu nhất dựa trên tiêu chí tìm kiếm đã phân tích (Nearest / Cheapest)
    /// </summary>
    /// <param name="criteria">Tiêu chí tìm kiếm</param>
    /// <param name="cancellationToken">Hủy thao tác</param>
    /// <returns>Kết quả gợi ý kèm lý do và số liệu cụ thể</returns>
    Task<ParkingRecommendationDto> RecommendParkingAsync(SmartSearchCriteriaDto criteria, CancellationToken cancellationToken = default);

    /// <summary>
    /// Xử lý end-to-end: Nhận câu hỏi tự nhiên -> Phân tích tiêu chí -> Trả về danh sách gợi ý
    /// </summary>
    Task<ParkingRecommendationDto> SmartSearchAsync(string naturalLanguagePrompt, double? userLatitude = null, double? userLongitude = null, CancellationToken cancellationToken = default);
}
