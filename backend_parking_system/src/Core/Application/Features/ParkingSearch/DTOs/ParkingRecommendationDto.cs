namespace ParkingSystem.Application.Features.ParkingSearch.DTOs;

/// <summary>
/// DTO chứa kết quả danh sách bãi xe được AI gợi ý tối ưu
/// </summary>
public record ParkingRecommendationDto
{
    /// <summary>
    /// Các tiêu chí đã được AI phân tích từ truy vấn của người dùng
    /// </summary>
    public SmartSearchCriteriaDto ParsedCriteria { get; init; } = new();

    /// <summary>
    /// Danh sách bãi xe được xếp hạng và gợi ý phù hợp nhất
    /// </summary>
    public List<ParkingLotRecommendationItemDto> RecommendedLots { get; init; } = [];

    /// <summary>
    /// Lời giải thích tổng quan từ AI về lý do đưa ra các gợi ý này
    /// </summary>
    public string SummaryExplanation { get; init; } = string.Empty;

    /// <summary>
    /// Thời gian AI phân tích và xếp hạng (ms)
    /// </summary>
    public long ProcessingTimeMs { get; init; }
}

/// <summary>
/// Chi tiết từng bãi đỗ xe trong danh sách gợi ý
/// </summary>
public record ParkingLotRecommendationItemDto
{
    public Guid ParkingLotId { get; init; }
    public string LotName { get; init; } = string.Empty;
    public string Address { get; init; } = string.Empty;
    public double DistanceMeters { get; init; }
    public decimal EstimatedTotalPrice { get; init; }
    public decimal PricePerHour { get; init; }
    public int AvailableSlots { get; init; }
    public int TotalCapacity { get; init; }
    public double OccupancyRatePercent { get; init; }
    public bool HasEvCharging { get; init; }
    public bool HasRoofedShelter { get; init; }
    public double MatchScore { get; init; }
    public string RecommendationReason { get; init; } = string.Empty;
}
