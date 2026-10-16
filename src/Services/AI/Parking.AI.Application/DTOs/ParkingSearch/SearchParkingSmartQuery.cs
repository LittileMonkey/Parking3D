namespace Parking.AI.Application.DTOs.ParkingSearch;

/// <summary>
/// Query yêu cầu tìm kiếm bãi đỗ xe thông minh bằng xử lý ngôn ngữ tự nhiên
/// </summary>
public record SearchParkingSmartQuery(
    string NaturalLanguagePrompt,
    double? UserCurrentLatitude = null,
    double? UserCurrentLongitude = null);
