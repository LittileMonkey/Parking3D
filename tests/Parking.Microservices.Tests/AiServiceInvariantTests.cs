using System.Net;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Parking.AI.Domain;
using Parking.AI.Infrastructure.AiVision;
using Parking.AI.Infrastructure.GenAi;
using Xunit;

namespace Parking.Microservices.Tests;

public sealed class AiServiceInvariantTests
{
    [Theory]
    [InlineData("51K-888.88", "51K88888", "51K-888.88")]
    [InlineData("51k 888.88", "51K88888", "51K-888.88")]
    [InlineData("30H99999", "30H99999", "30H-999.99")]
    [InlineData("59-P1 678.90", "59P167890", "59-P1 678.90")]
    [InlineData("43A-123.45", "43A12345", "43A-123.45")]
    public void PlateSeparation_ProducesValidAlphanumericForDatabaseAndFormattedForDisplay(
        string rawInput, string expectedDbPlate, string expectedDisplayPlate)
    {
        // 1. Phải chuẩn hóa ra dạng sạch dấu cho CSDL (DEF-01)
        var dbPlate = LicensePlateRecognitionService.ToAlphanumericPlate(rawInput);
        Assert.Equal(expectedDbPlate, dbPlate);

        // 2. Chuỗi DB plate phải thỏa mãn ràng buộc regex ^[A-Z0-9]{1,20}$ của CSDL và ImageRules
        Assert.True(ImageRules.IsNormalizedPlate(dbPlate), $"Biển số '{dbPlate}' phải thỏa mãn ImageRules.IsNormalizedPlate");

        // 3. Chuỗi hiển thị UI phải chuẩn hóa đẹp mắt
        var displayPlate = LicensePlateRecognitionService.FormatDisplayPlate(rawInput);
        Assert.Equal(expectedDisplayPlate, displayPlate);
    }

    [Fact]
    public void ReviewPlateSanitization_AllowsFormattedPlateInputWithoutFailing()
    {
        var rawWithSymbols = "51K-888.88";
        var sanitized = rawWithSymbols.Replace("-", "").Replace(".", "").Replace(" ", "").ToUpperInvariant();

        Assert.True(ImageRules.IsNormalizedPlate(sanitized));
        Assert.Equal("51K88888", sanitized);
    }

    [Fact]
    public void ImageRules_ValidatesMagicBytes_ForJpegAndPng()
    {
        // 1. Giả lập Header Magic Bytes chuẩn của ảnh JPEG (FF D8 FF)
        byte[] validJpegBytes = [0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46];
        Assert.True(ImageRules.IsSupported(validJpegBytes, "image/jpeg"));

        // 2. Giả lập Header Magic Bytes chuẩn của ảnh PNG (89 50 4E 47 0D 0A 1A 0A)
        byte[] validPngBytes = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00];
        Assert.True(ImageRules.IsSupported(validPngBytes, "image/png"));

        // 3. Giả lập file độc hại (.exe hoặc văn bản đổi tên thành .jpg)
        byte[] fakeExeBytes = [0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]; // Chữ ký MZ của file thực thi PE
        Assert.False(ImageRules.IsSupported(fakeExeBytes, "image/jpeg"), "Hệ thống phải từ chối file exe giả mạo đuôi ảnh");
    }

    [Fact]
    public void PythonPlateDetectionResponse_DeserializesLayoutEnrichedResponse()
    {
        var json = """
        {
            "plate_text": "59-P1 678.90",
            "confidence": 0.94,
            "plate_type": "TwoLine",
            "cropped_image_base64": "iVBORw0KGgoAAAANSUhEUgAA",
            "processing_time_ms": 78,
            "status": "valid",
            "format_valid": true,
            "error": null
        }
        """;

        var response = System.Text.Json.JsonSerializer.Deserialize<PythonPlateDetectionResponse>(json, new System.Text.Json.JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        });

        Assert.NotNull(response);
        Assert.Equal("59-P1 678.90", response.PlateText);
        Assert.Equal(0.94, response.Confidence);
        Assert.Equal("TwoLine", response.PlateType);
        Assert.Equal("valid", response.Status);
        Assert.True(response.FormatValid);
        Assert.Equal(78, response.ProcessingTimeMs);
    }

    [Fact]
    public async Task GeminiApiClient_UsesOllamaQwen25_WhenOllamaEndpointIsConfigured()
    {
        Uri? capturedUri = null;
        string? capturedPayload = null;

        var handler = new StubHttpMessageHandler(async (req, ct) =>
        {
            capturedUri = req.RequestUri;
            capturedPayload = req.Content != null ? await req.Content.ReadAsStringAsync(ct) : null;

            const string ollamaJson = """
            {
              "model": "qwen2.5:3b",
              "message": {
                "role": "assistant",
                "content": "Phản hồi trực tiếp từ Local LLM Qwen 2.5 3B [SUGGESTION: Xem giá vé]"
              },
              "done": true
            }
            """;

            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(ollamaJson, Encoding.UTF8, "application/json")
            };
        });

        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Ollama:Endpoint"] = "http://localhost:11434",
                ["Ollama:Model"] = "qwen2.5:3b",
                ["Gemini:ApiKey"] = "" // Không cần API Key
            })
            .Build();

        var client = new GeminiApiClient(new HttpClient(handler), config, NullLogger<GeminiApiClient>.Instance);
        var (text, isFallback) = await client.GenerateTextWithStatusAsync("System prompt", "Giá gửi xe ô tô?");

        Assert.False(isFallback);
        Assert.Equal(new Uri("http://localhost:11434/api/chat"), capturedUri);
        Assert.NotNull(capturedPayload);
        Assert.Contains("qwen2.5:3b", capturedPayload);
        Assert.Contains("Phản hồi trực tiếp từ Local LLM Qwen 2.5 3B", text);
    }

    [Theory]
    [InlineData("Tôi muốn biết vị trí chính xác nằm trên đường nào?", false)]
    [InlineData("Cho mình hỏi địa chỉ cụ thể ở quận mấy vậy?", false)]
    [InlineData("Bãi mở cửa từ mấy giờ đến mấy giờ?", false)]
    [InlineData("Đi xem phim ở Landmark 81 thì gửi xe ở bãi nào gần nhất?", false)]
    [InlineData("Nếu mình đến trễ hơn dự kiến 30 phút có bị hủy không?", false)]
    [InlineData("Còn cái thứ hai thì sao bạn?", true)] // Câu hỏi nối tiếp trong phiên hội thoại đã có lịch sử
    public void IsDefinitelyOutOfDomain_AllowsValidParkingLocationAndFollowUpQuestions(string message, bool hasPriorContext)
    {
        Assert.False(ParkingAssistantService.IsDefinitelyOutOfDomain(message, hasPriorContext));
    }

    [Theory]
    [InlineData("Hãy viết code Python giải phương trình bậc 2", false)]
    [InlineData("Sáng tác bài thơ về tình yêu đôi lứa", true)]
    public void IsDefinitelyOutOfDomain_BlocksStrictlyOffTopicRequests(string message, bool hasPriorContext)
    {
        Assert.True(ParkingAssistantService.IsDefinitelyOutOfDomain(message, hasPriorContext));
    }

    private sealed class StubHttpMessageHandler(Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> handler) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) =>
            handler(request, cancellationToken);
    }
}
