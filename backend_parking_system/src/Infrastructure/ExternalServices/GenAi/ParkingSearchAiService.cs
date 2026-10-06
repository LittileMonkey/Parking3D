using System.Diagnostics;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using ParkingSystem.Application.Common.Interfaces;
using ParkingSystem.Application.Features.ParkingSearch.DTOs;
using ParkingSystem.Domain.Enums;
using ParkingSystem.Infrastructure.ExternalServices.GenAi.Prompts;

namespace ParkingSystem.Infrastructure.ExternalServices.GenAi;

/// <summary>
/// Dịch vụ tìm kiếm bãi xe thông minh kết hợp GenAI NLP và thuật toán Haversine / Dynamic Pricing
/// </summary>
public class ParkingSearchAiService(
    GeminiApiClient geminiClient,
    ILogger<ParkingSearchAiService> logger) : IParkingSearchAiService
{
    public async Task<SmartSearchCriteriaDto> ParseSearchIntentAsync(string naturalLanguagePrompt, CancellationToken cancellationToken = default)
    {
        var rawAiOutput = await geminiClient.GenerateTextAsync(
            SmartSearchParserPrompts.SystemPrompt,
            SmartSearchParserPrompts.BuildUserQueryPrompt(naturalLanguagePrompt),
            cancellationToken);

        var cleanedJson = ExtractJsonBlock(rawAiOutput);

        try
        {
            var criteria = JsonSerializer.Deserialize<SmartSearchCriteriaDto>(cleanedJson, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });

            if (criteria != null)
            {
                return criteria;
            }
        }
        catch (JsonException ex)
        {
            logger.LogWarning(ex, "Không thể parse JSON từ phản hồi của Gemini: {RawText}", rawAiOutput);
        }

        // Default fallback nếu parse lỗi
        return new SmartSearchCriteriaDto
        {
            DestinationName = "Khu vực trung tâm",
            VehicleType = VehicleType.Car,
            DesiredRadiusMeters = 1000,
            ExpectedDurationHours = 2.0,
            PriorityStrategy = "NEAREST"
        };
    }

    public Task<ParkingRecommendationDto> RecommendParkingAsync(SmartSearchCriteriaDto criteria, CancellationToken cancellationToken = default)
    {
        var stopwatch = Stopwatch.StartNew();

        // Danh sách các bãi xe mẫu trong mạng lưới Multi-Parking Platform
        var candidateLots = GetMockParkingLots();

        var originLat = criteria.Latitude ?? 10.7950;
        var originLon = criteria.Longitude ?? 106.7218;

        var scoredItems = candidateLots.Select(lot =>
        {
            // 1. Tính khoảng cách Haversine (mét)
            var distanceMeters = CalculateHaversineDistanceMeters(originLat, originLon, lot.Latitude, lot.Longitude);

            // 2. Tính chi phí dự kiến cho toàn bộ thời lượng
            var pricePerHour = criteria.VehicleType == VehicleType.Motorbike ? lot.MotorbikePricePerHour : lot.CarPricePerHour;
            var estimatedTotal = (decimal)criteria.ExpectedDurationHours * pricePerHour;

            // 3. Tỷ lệ lấp đầy
            var occupancyPercent = (double)(lot.TotalSlots - lot.AvailableSlots) / lot.TotalSlots * 100.0;

            // 4. Tính điểm phù hợp (MatchScore)
            double score = 100.0;
            if (criteria.PriorityStrategy.Equals("NEAREST", StringComparison.OrdinalIgnoreCase))
            {
                score -= (distanceMeters / 50.0); // Càng gần điểm càng cao
            }
            else // CHEAPEST
            {
                score -= (double)(estimatedTotal / 1000m); // Càng rẻ điểm càng cao
            }

            if (lot.AvailableSlots <= 0) score -= 100.0; // Hết chỗ bị trừ mạnh

            var reason = criteria.PriorityStrategy.Equals("CHEAPEST", StringComparison.OrdinalIgnoreCase)
                ? $"Giá tiết kiệm chỉ {pricePerHour:N0}đ/h, cách điểm đến {Math.Round(distanceMeters)}m"
                : $"Vị trí cực gần, chỉ cách điểm đến {Math.Round(distanceMeters)}m, còn {lot.AvailableSlots} chỗ trống";

            return new ParkingLotRecommendationItemDto
            {
                ParkingLotId = lot.Id,
                LotName = lot.Name,
                Address = lot.Address,
                DistanceMeters = Math.Round(distanceMeters, 1),
                PricePerHour = pricePerHour,
                EstimatedTotalPrice = estimatedTotal,
                AvailableSlots = lot.AvailableSlots,
                TotalCapacity = lot.TotalSlots,
                OccupancyRatePercent = Math.Round(occupancyPercent, 1),
                HasEvCharging = lot.HasEvCharging,
                HasRoofedShelter = lot.HasRoofedShelter,
                MatchScore = Math.Round(score, 1),
                RecommendationReason = reason
            };
        })
        .Where(x => criteria.MaxPricePerHour == null || x.PricePerHour <= criteria.MaxPricePerHour.Value)
        .OrderByDescending(x => x.MatchScore)
        .ToList();

        stopwatch.Stop();

        var summary = scoredItems.Count > 0
            ? $"Hệ thống đã tìm thấy {scoredItems.Count} bãi đỗ xe phù hợp với yêu cầu ({criteria.PriorityStrategy} - {criteria.VehicleType}). Bãi đỗ '{scoredItems[0].LotName}' là lựa chọn tối ưu nhất."
            : "Không tìm thấy bãi xe nào đáp ứng hoàn toàn bộ lọc giá hoặc khoảng cách mong muốn. Bạn hãy thử mở rộng bán kính tìm kiếm.";

        return Task.FromResult(new ParkingRecommendationDto
        {
            ParsedCriteria = criteria,
            RecommendedLots = scoredItems,
            SummaryExplanation = summary,
            ProcessingTimeMs = stopwatch.ElapsedMilliseconds
        });
    }

    public async Task<ParkingRecommendationDto> SmartSearchAsync(
        string naturalLanguagePrompt,
        double? userLatitude = null,
        double? userLongitude = null,
        CancellationToken cancellationToken = default)
    {
        var criteria = await ParseSearchIntentAsync(naturalLanguagePrompt, cancellationToken);

        if (userLatitude.HasValue && userLongitude.HasValue)
        {
            criteria = criteria with
            {
                Latitude = userLatitude.Value,
                Longitude = userLongitude.Value
            };
        }

        return await RecommendParkingAsync(criteria, cancellationToken);
    }

    /// <summary>
    /// Công thức Haversine chuẩn tính khoảng cách địa lý giữa 2 tọa độ GPS (mét)
    /// </summary>
    private static double CalculateHaversineDistanceMeters(double lat1, double lon1, double lat2, double lon2)
    {
        const double earthRadiusMeters = 6371000.0;
        var dLat = ToRadians(lat2 - lat1);
        var dLon = ToRadians(lon2 - lon1);

        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                Math.Cos(ToRadians(lat1)) * Math.Cos(ToRadians(lat2)) *
                Math.Sin(dLon / 2) * Math.Sin(dLon / 2);

        var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
        return earthRadiusMeters * c;
    }

    private static double ToRadians(double degrees) => degrees * Math.PI / 180.0;

    private static string ExtractJsonBlock(string raw)
    {
        var trimmed = raw.Trim();
        if (trimmed.StartsWith("```json", StringComparison.OrdinalIgnoreCase))
        {
            trimmed = trimmed[7..];
        }
        else if (trimmed.StartsWith("```"))
        {
            trimmed = trimmed[3..];
        }

        if (trimmed.EndsWith("```"))
        {
            trimmed = trimmed[..^3];
        }

        return trimmed.Trim();
    }

    private static List<MockLotDefinition> GetMockParkingLots() =>
    [
        new(Guid.Parse("11111111-1111-1111-1111-111111111111"), "Bãi xe Smart Central Tower", "208 Nguyễn Hữu Cảnh, P.22, Bình Thạnh", 10.7942, 106.7215, 20000, 5000, 350, 400, true, true),
        new(Guid.Parse("22222222-2222-2222-2222-222222222222"), "Bãi xe Park View Riverside", "20A Ung Văn Khiêm, P.25, Bình Thạnh", 10.8015, 106.7160, 15000, 4000, 120, 250, false, true),
        new(Guid.Parse("33333333-3333-3333-3333-333333333333"), "Bãi xe Công viên Vinhomes", "720A Điện Biên Phủ, P.22, Bình Thạnh", 10.7920, 106.7198, 25000, 6000, 80, 500, true, true),
        new(Guid.Parse("44444444-4444-4444-4444-444444444444"), "Bãi xe Giá rẻ Cầu Sài Gòn", "Ung Văn Khiêm, P.25, Bình Thạnh", 10.8030, 106.7230, 10000, 3000, 15, 100, false, false)
    ];

    private record MockLotDefinition(
        Guid Id,
        string Name,
        string Address,
        double Latitude,
        double Longitude,
        decimal CarPricePerHour,
        decimal MotorbikePricePerHour,
        int AvailableSlots,
        int TotalSlots,
        bool HasEvCharging,
        bool HasRoofedShelter);
}
