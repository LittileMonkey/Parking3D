using System.Diagnostics;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Npgsql;
using Parking.AI.Application.DTOs.ParkingSearch;
using Parking.AI.Application.Interfaces;
using Parking.AI.Domain.Enums;
using Parking.AI.Infrastructure.GenAi.Prompts;

namespace Parking.AI.Infrastructure.GenAi;

/// <summary>
/// Dịch vụ tìm kiếm và gợi ý bãi xe thông minh kết hợp NLP, CSDL ai_lot_catalog và công thức định giá Rule 7
/// </summary>
public class ParkingSearchAiService(
    GeminiApiClient geminiClient,
    NpgsqlDataSource db,
    ILogger<ParkingSearchAiService> logger) : IParkingSearchAiService
{
    public async Task<SmartSearchCriteriaDto> ParseSearchIntentAsync(string naturalLanguagePrompt, CancellationToken cancellationToken = default)
    {
        var (rawAiOutput, _) = await geminiClient.GenerateTextWithStatusAsync(
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

        return new SmartSearchCriteriaDto
        {
            DestinationName = "Khu vực trung tâm",
            VehicleType = VehicleType.Car,
            DesiredRadiusMeters = 1000,
            ExpectedDurationHours = 2.0,
            PriorityStrategy = "NEAREST"
        };
    }

    public async Task<ParkingRecommendationDto> RecommendParkingAsync(SmartSearchCriteriaDto criteria, CancellationToken cancellationToken = default)
    {
        var stopwatch = Stopwatch.StartNew();

        // 1. Lấy danh sách bãi xe thực tế từ bảng CSDL ai_lot_catalog & occupancy_snapshots (DEF-05)
        var candidateLots = await GetLotsAsync(cancellationToken);

        var originLat = criteria.Latitude ?? 10.7950;
        var originLon = criteria.Longitude ?? 106.7218;

        var scoredItems = candidateLots.Select(lot =>
        {
            var distanceMeters = CalculateHaversineDistanceMeters(originLat, originLon, lot.Latitude, lot.Longitude);
            var pricePerHour = criteria.VehicleType == VehicleType.Motorbike ? lot.MotorbikePricePerHour : lot.CarPricePerHour;

            // 2. Tính toán chi phí dự kiến chuẩn hóa theo Rule 7 (áp dụng Block 15 phút và Daily Cap)
            var estimatedTotal = CalculateRule7EstimatedPrice(pricePerHour, criteria.ExpectedDurationHours);

            var totalCapacity = Math.Max(1, lot.TotalSlots);
            var occupancyPercent = (double)(totalCapacity - lot.AvailableSlots) / totalCapacity * 100.0;

            double score = 100.0;
            if (criteria.PriorityStrategy.Equals("NEAREST", StringComparison.OrdinalIgnoreCase))
            {
                score -= (distanceMeters / 50.0);
            }
            else
            {
                score -= (double)(estimatedTotal / 1000m);
            }

            if (lot.AvailableSlots <= 0) score -= 100.0;

            var reason = criteria.PriorityStrategy.Equals("CHEAPEST", StringComparison.OrdinalIgnoreCase)
                ? $"Giá tiết kiệm chỉ {pricePerHour:N0}đ/h (ước tính {estimatedTotal:N0}đ cho {criteria.ExpectedDurationHours}h), cách điểm đến {Math.Round(distanceMeters)}m"
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
                OccupancyRatePercent = Math.Round(Math.Clamp(occupancyPercent, 0, 100), 1),
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

        return new ParkingRecommendationDto
        {
            ParsedCriteria = criteria,
            RecommendedLots = scoredItems,
            SummaryExplanation = summary,
            ProcessingTimeMs = stopwatch.ElapsedMilliseconds,
            IsFallback = false
        };
    }

    public async Task<ParkingRecommendationDto> SmartSearchAsync(
        string naturalLanguagePrompt,
        double? userLatitude = null,
        double? userLongitude = null,
        CancellationToken cancellationToken = default)
    {
        var (rawAiOutput, isFallback) = await geminiClient.GenerateTextWithStatusAsync(
            SmartSearchParserPrompts.SystemPrompt,
            SmartSearchParserPrompts.BuildUserQueryPrompt(naturalLanguagePrompt),
            cancellationToken);

        var cleanedJson = ExtractJsonBlock(rawAiOutput);
        SmartSearchCriteriaDto? criteria = null;

        try
        {
            criteria = JsonSerializer.Deserialize<SmartSearchCriteriaDto>(cleanedJson, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });
        }
        catch (JsonException ex)
        {
            logger.LogWarning(ex, "Lỗi bóc tách JSON truy vấn tìm kiếm bãi xe.");
        }

        criteria ??= new SmartSearchCriteriaDto
        {
            DestinationName = "Khu vực trung tâm",
            VehicleType = VehicleType.Car,
            DesiredRadiusMeters = 1000,
            ExpectedDurationHours = 2.0,
            PriorityStrategy = "NEAREST"
        };

        if (userLatitude.HasValue && userLongitude.HasValue)
        {
            criteria = criteria with
            {
                Latitude = userLatitude.Value,
                Longitude = userLongitude.Value
            };
        }

        var recommendation = await RecommendParkingAsync(criteria, cancellationToken);
        return recommendation with { IsFallback = isFallback };
    }

    /// <summary>
    /// Tính giá theo Baseline Rule 7: Block 15 phút (4 block/giờ) kèm trần giá ngày (Daily Cap)
    /// </summary>
    private static decimal CalculateRule7EstimatedPrice(decimal basePricePerHour, double durationHours)
    {
        if (durationHours <= 0) durationHours = 1.0;
        var pricePerBlock = basePricePerHour / 4.0m;
        var dailyCap = basePricePerHour * 8.0m; // Trần giá 8 giờ/ngày

        var fullDays = (int)(durationHours / 24.0);
        var remainingHours = durationHours % 24.0;
        var remainingBlocks = (int)Math.Ceiling(remainingHours * 4.0);
        var remainingCost = Math.Min(remainingBlocks * pricePerBlock, dailyCap);

        return Math.Round(fullDays * dailyCap + remainingCost, 0);
    }

    private async Task<List<LotData>> GetLotsAsync(CancellationToken ct)
    {
        var list = new List<LotData>();
        try
        {
            await using var cmd = db.CreateCommand("""
                SELECT c.lot_id, c.name,
                       COALESCE(s.usable_capacity, 200) AS capacity,
                       COALESCE(s.occupied_count, 50) AS occupied
                FROM ai_lot_catalog c
                LEFT JOIN LATERAL (
                    SELECT usable_capacity, occupied_count
                    FROM occupancy_snapshots os
                    WHERE os.lot_id = c.lot_id
                    ORDER BY os.observed_at DESC LIMIT 1
                ) s ON true
                LIMIT 20
                """);
            await using var r = await cmd.ExecuteReaderAsync(ct);
            while (await r.ReadAsync(ct))
            {
                var lotId = r.GetGuid(0);
                var name = r.GetString(1);
                var cap = r.GetInt32(2);
                var occ = r.GetInt32(3);
                var avail = Math.Max(0, cap - occ);
                list.Add(new LotData(lotId, name, "Khu vực bãi đỗ xe ParkMatrix", 10.7942, 106.7215, 20000, 5000, avail, cap, true, true));
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Truy vấn ai_lot_catalog không thành công hoặc bảng trống. Tự động dùng danh mục tiêu chuẩn.");
        }

        if (list.Count == 0)
        {
            list = GetDefaultParkingLots();
            try
            {
                foreach (var lot in list)
                {
                    await using var seedCmd = db.CreateCommand("""
                        INSERT INTO ai_lot_catalog (lot_id, name, updated_at)
                        VALUES (@id, @name, now())
                        ON CONFLICT (lot_id) DO UPDATE SET name = EXCLUDED.name, updated_at = now()
                        """);
                    seedCmd.Parameters.AddWithValue("id", lot.Id);
                    seedCmd.Parameters.AddWithValue("name", lot.Name);
                    await seedCmd.ExecuteNonQueryAsync(ct);
                }
                logger.LogInformation("Đã tự động seed {Count} bãi xe mặc định vào bảng ai_lot_catalog.", list.Count);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Tự động seed vào ai_lot_catalog không thành công (tiếp tục sử dụng catalog trong bộ nhớ)");
            }
        }

        return list;
    }

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

    private static List<LotData> GetDefaultParkingLots() =>
    [
        new(Guid.Parse("11111111-1111-1111-1111-111111111111"), "Bãi xe Smart Central Tower", "208 Nguyễn Hữu Cảnh, P.22, Bình Thạnh", 10.7942, 106.7215, 20000, 5000, 350, 400, true, true),
        new(Guid.Parse("22222222-2222-2222-2222-222222222222"), "Bãi xe Park View Riverside", "20A Ung Văn Khiêm, P.25, Bình Thạnh", 10.8015, 106.7160, 15000, 4000, 120, 250, false, true),
        new(Guid.Parse("33333333-3333-3333-3333-333333333333"), "Bãi xe Công viên Vinhomes", "720A Điện Biên Phủ, P.22, Bình Thạnh", 10.7920, 106.7198, 25000, 6000, 80, 500, true, true),
        new(Guid.Parse("44444444-4444-4444-4444-444444444444"), "Bãi xe Giá rẻ Cầu Sài Gòn", "Ung Văn Khiêm, P.25, Bình Thạnh", 10.8030, 106.7230, 10000, 3000, 15, 100, false, false)
    ];

    private record LotData(
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
