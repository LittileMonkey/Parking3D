using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace ParkingSystem.Infrastructure.ExternalServices.GenAi;

/// <summary>
/// Client kết nối trực tiếp với Google Gemini API (hoặc Ollama endpoint) phục vụ GenAI và NLP
/// </summary>
public class GeminiApiClient(
    HttpClient httpClient,
    IConfiguration configuration,
    ILogger<GeminiApiClient> logger)
{
    private readonly string _apiKey = configuration["Gemini:ApiKey"] ?? configuration["AI:GeminiApiKey"] ?? string.Empty;
    private readonly string _model = configuration["Gemini:Model"] ?? "gemini-1.5-flash";

    public async Task<string> GenerateTextAsync(string systemInstruction, string userPrompt, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(_apiKey))
        {
            logger.LogInformation("Gemini API Key chưa được cấu hình. Sử dụng bộ suy luận AI cục bộ mô phỏng.");
            return GenerateSimulatedResponse(userPrompt);
        }

        var endpoint = $"https://generativelanguage.googleapis.com/v1beta/models/{_model}:generateContent?key={_apiKey}";

        try
        {
            var requestBody = new
            {
                contents = new[]
                {
                    new
                    {
                        parts = new[]
                        {
                            new { text = $"{systemInstruction}\n\n{userPrompt}" }
                        }
                    }
                },
                generationConfig = new
                {
                    temperature = 0.2,
                    maxOutputTokens = 1024
                }
            };

            var jsonContent = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");
            var response = await httpClient.PostAsync(endpoint, jsonContent, ct);

            if (response.IsSuccessStatusCode)
            {
                var responseJson = await response.Content.ReadAsStringAsync(ct);
                using var doc = JsonDocument.Parse(responseJson);

                if (doc.RootElement.TryGetProperty("candidates", out var candidates) &&
                    candidates.GetArrayLength() > 0 &&
                    candidates[0].TryGetProperty("content", out var content) &&
                    content.TryGetProperty("parts", out var parts) &&
                    parts.GetArrayLength() > 0 &&
                    parts[0].TryGetProperty("text", out var textElem))
                {
                    return textElem.GetString() ?? string.Empty;
                }
            }
            else
            {
                logger.LogWarning("Gemini API trả về mã lỗi {StatusCode}", response.StatusCode);
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Lỗi khi gọi Gemini API. Tự động chuyển đổi sang bộ xử lý thông minh fallback.");
        }

        return GenerateSimulatedResponse(userPrompt);
    }

    /// <summary>
    /// Bộ phản hồi mô phỏng thông minh cho cả chế độ Smart Search bóc tách JSON và Trợ lý AI
    /// </summary>
    private static string GenerateSimulatedResponse(string prompt)
    {
        var lower = prompt.ToLowerInvariant();

        // Xử lý bóc tách JSON cho Smart Search
        if (lower.Contains("trả về json") || lower.Contains("bóc tách"))
        {
            var isMotorbike = lower.Contains("xe máy") || lower.Contains("moto") || lower.Contains("xe 2 bánh");
            var isEv = lower.Contains("điện") || lower.Contains("sạc");
            var isCheapest = lower.Contains("rẻ") || lower.Contains("tiết kiệm");

            var destination = "Khu vực trung tâm";
            if (lower.Contains("landmark")) destination = "Landmark 81";
            else if (lower.Contains("bến thành")) destination = "Chợ Bến Thành";
            else if (lower.Contains("sân bay") || lower.Contains("tân sơn nhất")) destination = "Sân bay Tân Sơn Nhất";

            var vehicleType = isEv ? "ElectricVehicle" : (isMotorbike ? "Motorbike" : "Car");
            var maxPrice = lower.Contains("20k") ? 20000 : (lower.Contains("10k") ? 10000 : 30000);

            return $$"""
            {
              "destinationName": "{{destination}}",
              "latitude": 10.7950,
              "longitude": 106.7218,
              "vehicleType": "{{vehicleType}}",
              "maxPricePerHour": {{maxPrice}},
              "desiredRadiusMeters": 1000,
              "expectedDurationHours": 2.0,
              "specialRequirements": [],
              "priorityStrategy": "{{(isCheapest ? "CHEAPEST" : "NEAREST")}}"
            }
            """;
        }

        // Xử lý phản hồi cho Chat Assistant
        if (lower.Contains("mất vé") || lower.Contains("mất thẻ"))
        {
            return "Dạ bạn đừng lo lắng! Khi mất thẻ/vé xe, bạn hãy đến quầy bảo vệ tại chốt trực, xuất trình CCCD và Cà-vẹt xe để nhân viên đối soát camera và kiểm tra ảnh biển số lúc xe vào. Phí cấp lại thẻ là 50.000 VNĐ cộng với tiền gửi xe thực tế.\n\n[SUGGESTION: Tôi muốn gọi nhân viên hỗ trợ ngay]\n[SUGGESTION: Biểu giá gửi xe tính như thế nào?]";
        }

        if (lower.Contains("giá") || lower.Contains("phí") || lower.Contains("bao nhiêu"))
        {
            return "Biểu giá gửi xe hiện tại của hệ thống:\n- Xe máy: 5.000đ/4 giờ đầu (ban ngày), qua đêm 10.000đ/lượt. Vé tháng 120.000đ/tháng.\n- Ô tô: 20.000đ/2 giờ đầu (ban ngày), 15.000đ/giờ tiếp theo. Qua đêm 80.000đ. Vé tháng 1.500.000đ/tháng.\n- Xe điện: Miễn phí 1 giờ đỗ đầu tiên nếu sử dụng trụ sạc tại Zone E.\n\n[SUGGESTION: Đặt chỗ trước ô tô như thế nào?]\n[SUGGESTION: Thời gian giữ chỗ là bao lâu?]";
        }

        if (lower.Contains("giữ chỗ") || lower.Contains("hold") || lower.Contains("đặt chỗ"))
        {
            return "Thời gian giữ chỗ (Hold time) mặc định của hệ thống là 15 phút kể từ khi bạn xác nhận đặt chỗ. Nếu quá 15 phút xe chưa qua barrier vào bãi, vị trí đỗ sẽ được tự động giải phóng cho các xe khác.\n\n[SUGGESTION: Tìm bãi đỗ xe gần nhất]\n[SUGGESTION: Xem bản đồ 3D bãi xe]";
        }

        return "Xin chào bạn! Tôi là Trợ lý AI của Hệ thống Quản lý Bãi đỗ xe Thông minh. Tôi có thể hỗ trợ bạn tìm bãi đỗ xe gần nhất, tra cứu giá vé, hướng dẫn thủ tục mất vé xe hoặc giải đáp quy định gửi xe. Bạn cần tôi giúp gì hôm nay?\n\n[SUGGESTION: Biểu giá gửi xe hiện tại]\n[SUGGESTION: Tìm bãi đỗ xe gần tôi]";
    }
}
