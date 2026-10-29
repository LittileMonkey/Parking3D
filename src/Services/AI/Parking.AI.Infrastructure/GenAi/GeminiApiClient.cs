using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Parking.AI.Infrastructure.GenAi;

/// <summary>
/// HTTP Client giao tiếp trực tiếp với Google Gemini Generative Language REST API.
/// <para>
/// <b>Thư viện & Công nghệ chủ chốt:</b>
/// <list type="bullet">
///   <item><description><see cref="HttpClient"/>: Thực hiện gọi HTTP POST REST API tới endpoint <c>generativelanguage.googleapis.com</c>.</description></item>
///   <item><description><see cref="System.Text.Json.JsonDocument"/>: Phân tích cú pháp JSON dạng DOM chỉ đọc (Read-only Document Object Model). Phương pháp này cực kỳ tiết kiệm bộ nhớ RAM (Zero-allocation/Low-overhead) vì không cần khởi tạo các DTO trung gian phức tạp cho cấu trúc phản hồi lồng nhau của Google AI.</description></item>
///   <item><description><b>Temperature (Nhiệt độ sáng tạo trong LLM):</b> Cấu hình ở mức <c>0.2</c> (thấp) để mô hình đưa ra câu trả lời có tính tất định (deterministic), chính xác và tuân thủ định dạng JSON/FAQ quy định thay vì tự do tưởng tượng.</description></item>
///   <item><description><b>MaxOutputTokens:</b> Giới hạn 1024 token để kiểm soát chi phí Quota và thời gian phản hồi mạng.</description></item>
///   <item><description><b>Rule-Based AI Fallback Simulator:</b> Bộ giả lập phản hồi thông minh chạy hoàn toàn offline (khi không có API key hoặc mất mạng), phân tích từ khóa để trả lời chuẩn nghiệp vụ bãi xe.</description></item>
/// </list>
/// </para>
/// </summary>
public class GeminiApiClient(
    HttpClient httpClient,
    IConfiguration configuration,
    ILogger<GeminiApiClient> logger)
{
    private readonly string _apiKey = configuration["Gemini:ApiKey"] ?? configuration["AI:GeminiApiKey"] ?? string.Empty;
    private readonly string _model = configuration["Gemini:Model"] ?? "gemini-2.5-flash";

    /// <summary>
    /// Gửi câu lệnh và chỉ dẫn hệ thống tới Gemini AI để sinh văn bản trả lời.
    /// </summary>
    /// <param name="systemInstruction">Chỉ dẫn ngữ cảnh, quy tắc và tri thức nền tảng của hệ thống (System Prompt)</param>
    /// <param name="userPrompt">Nội dung câu hỏi hoặc yêu cầu của người dùng (User Prompt)</param>
    /// <param name="ct">CancellationToken</param>
    /// <returns>Chuỗi văn bản kết quả do AI sinh ra</returns>
    public async Task<string> GenerateTextAsync(string systemInstruction, string userPrompt, CancellationToken ct = default)
    {
        var (text, _) = await GenerateTextWithStatusAsync(systemInstruction, userPrompt, ct);
        return text;
    }

    /// <summary>
    /// Gửi câu lệnh tới Gemini AI và kèm theo trạng thái cờ <c>IsFallback</c> để báo cáo cho hệ thống biết phản hồi từ AI thật hay từ bộ giả lập.
    /// </summary>
    /// <param name="systemInstruction">Chỉ dẫn hệ thống</param>
    /// <param name="userPrompt">Câu hỏi người dùng</param>
    /// <param name="ct">CancellationToken</param>
    /// <returns>Bộ dữ liệu gồm <c>Text</c> (kết quả văn bản) và <c>IsFallback</c> (true nếu chạy bằng bộ mô phỏng)</returns>
    public async Task<(string Text, bool IsFallback)> GenerateTextWithStatusAsync(string systemInstruction, string userPrompt, CancellationToken ct = default)
    {
        // Kiểm tra xem đã có API Key hợp lệ được cấu hình hay chưa
        if (string.IsNullOrWhiteSpace(_apiKey))
        {
            logger.LogInformation("Gemini API Key chưa được cấu hình. Sử dụng bộ suy luận AI cục bộ mô phỏng.");
            return (GenerateSimulatedResponse(userPrompt), true);
        }

        // Endpoint REST chuẩn của Google Generative Language API v1beta
        var endpoint = $"https://generativelanguage.googleapis.com/v1beta/models/{_model}:generateContent?key={_apiKey}";

        try
        {
            // Cấu trúc Payload JSON theo đặc tả Gemini REST API
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
                    temperature = 0.2,       // Nhiệt độ thấp giúp phản hồi bám sát dữ liệu và chuẩn cấu trúc JSON
                    maxOutputTokens = 512,   // Giới hạn độ dài output để phản hồi nhanh chóng
                    thinkingConfig = new
                    {
                        thinkingBudget = 0   // Giảm thiểu thời gian suy nghĩ nội bộ để phản hồi nhanh
                    }
                }
            };

            var jsonContent = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");
            var response = await httpClient.PostAsync(endpoint, jsonContent, ct);

            if (response.IsSuccessStatusCode)
            {
                var responseJson = await response.Content.ReadAsStringAsync(ct);

                // JsonDocument.Parse: Truy xuất cây DOM JSON một cách linh hoạt mà không cần tạo hàng chục DTO lồng nhau
                using var doc = JsonDocument.Parse(responseJson);

                // Duyệt cây JSON an toàn: candidates[0].content.parts[0].text
                if (doc.RootElement.TryGetProperty("candidates", out var candidates) &&
                    candidates.GetArrayLength() > 0 &&
                    candidates[0].TryGetProperty("content", out var content) &&
                    content.TryGetProperty("parts", out var parts) &&
                    parts.GetArrayLength() > 0 &&
                    parts[0].TryGetProperty("text", out var textElem))
                {
                    return (textElem.GetString() ?? string.Empty, false);
                }
            }
            else
            {
                logger.LogWarning("Gemini API trả về mã lỗi {StatusCode}", response.StatusCode);
            }
        }
        catch (Exception ex)
        {
            // Bắt lỗi kết nối mạng / timeout / rate limit để chuyển sang chế độ fallback thông minh
            logger.LogWarning(ex, "Lỗi khi gọi Gemini API. Tự động chuyển đổi sang bộ xử lý thông minh fallback.");
        }

        return (GenerateSimulatedResponse(userPrompt), true);
    }

    /// <summary>
    /// Bộ phản hồi mô phỏng nghiệp vụ thông minh cho cả 2 luồng:
    /// <list type="number">
    ///   <item><description><b>Smart Search:</b> Phân tích từ khóa để trả về khối JSON cấu trúc đúng schema cho bãi xe</description></item>
    ///   <item><description><b>Trợ lý AI:</b> Giải đáp thắc mắc về giá vé, thủ tục mất thẻ, thời gian giữ chỗ chờ thanh toán (mặc định 5p) kèm gợi ý thao tác nhanh [SUGGESTION]</description></item>
    /// </list>
    /// </summary>
    private static string GenerateSimulatedResponse(string prompt)
    {
        var lower = prompt.ToLowerInvariant();

        // 1. Phân luồng bóc tách ý định tìm kiếm bãi xe (Smart Search Intent Extraction)
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

            // Cú pháp C# 11 Raw String Literal với 2 dấu $$ cho phép lồng chuỗi JSON có ngoặc nhọn thuần túy
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

        // 2. Tình huống: Khách hỏi quy trình mất thẻ / mất vé xe
        if (lower.Contains("mất vé") || lower.Contains("mất thẻ"))
        {
            return "Dạ bạn đừng lo lắng! Khi mất thẻ/vé xe, bạn hãy đến quầy bảo vệ tại chốt trực, xuất trình CCCD và Cà-vẹt xe để nhân viên đối soát camera và kiểm tra ảnh biển số lúc xe vào. Phí cấp lại thẻ là 50.000 VNĐ cộng với tiền gửi xe thực tế.\n\n[SUGGESTION: Tôi muốn gọi nhân viên hỗ trợ ngay]\n[SUGGESTION: Biểu giá gửi xe tính như thế nào?]";
        }

        // 3. Tình huống: Khách hỏi về biểu phí, giá gửi xe
        if (lower.Contains("giá") || lower.Contains("phí") || lower.Contains("bao nhiêu"))
        {
            return "Biểu giá gửi xe hiện tại của hệ thống:\n- Xe máy: 5.000đ/4 giờ đầu (ban ngày), qua đêm 10.000đ/lượt. Vé tháng 120.000đ/tháng.\n- Ô tô: 20.000đ/2 giờ đầu (ban ngày), 15.000đ/giờ tiếp theo. Qua đêm 80.000đ. Vé tháng 1.500.000đ/tháng.\n- Xe điện: Miễn phí 1 giờ đỗ đầu tiên nếu sử dụng trụ sạc tại Zone E.\n\n[SUGGESTION: Đặt chỗ trước ô tô như thế nào?]\n[SUGGESTION: Thời gian giữ chỗ là bao lâu?]";
        }

        // 4. Hold chờ thanh toán mặc định 5 phút theo SCRUM-100; tách biệt hạn đến bãi.
        if (lower.Contains("giữ chỗ") || lower.Contains("hold") || lower.Contains("đặt chỗ"))
        {
            return "Thời gian giữ chỗ chờ thanh toán mặc định là 5 phút, có thể cấu hình theo từng bãi và loại xe. Bạn xem thời điểm hết hạn do hệ thống trả về trên màn hình đặt chỗ. Nếu chưa thanh toán khi hết hạn, backend sẽ xử lý hết hold. Booking đã xác nhận và chỗ đang có xe thực tế được bảo vệ; thời hạn đến bãi là quy định riêng.\n\n[SUGGESTION: Tìm bãi đỗ xe gần nhất]\n[SUGGESTION: Xem bản đồ 3D bãi xe]";
        }

        // 5. Câu chào hỏi mặc định
        return "Xin chào bạn! Tôi là Trợ lý AI của Hệ thống Quản lý Bãi đỗ xe Thông minh. Tôi có thể hỗ trợ bạn tìm bãi đỗ xe gần nhất, tra cứu giá vé, hướng dẫn thủ tục mất vé xe hoặc giải đáp quy định gửi xe. Bạn cần tôi giúp gì hôm nay?\n\n[SUGGESTION: Biểu giá gửi xe hiện tại]\n[SUGGESTION: Tìm bãi đỗ xe gần tôi]";
    }
}
