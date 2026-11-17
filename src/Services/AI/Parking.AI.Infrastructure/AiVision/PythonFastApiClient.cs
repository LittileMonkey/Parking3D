using Parking.ServiceDefaults;
using System.Net.Http.Headers;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Parking.AI.Infrastructure.AiVision;

/// <summary>
/// DTO hứng dữ liệu phản hồi từ Microservice Python YOLOv8 + PaddleOCR
/// </summary>
public record PythonPlateDetectionResponse
{
    [JsonPropertyName("plate_text")]
    public string PlateText { get; init; } = string.Empty;

    [JsonPropertyName("confidence")]
    public double Confidence { get; init; }

    [JsonPropertyName("plate_type")]
    public string PlateType { get; init; } = "OneLine";

    [JsonPropertyName("cropped_image_base64")]
    public string? CroppedImageBase64 { get; init; }

    [JsonPropertyName("processing_time_ms")]
    public long ProcessingTimeMs { get; init; }

    [JsonPropertyName("status")]
    public string? Status { get; init; }

    [JsonPropertyName("format_valid")]
    public bool? FormatValid { get; init; }

    [JsonPropertyName("error")]
    public string? Error { get; init; }

    [JsonIgnore]
    public bool IsFallback { get; init; }
}

/// <summary>
/// HTTP Client chuyên dụng kết nối tới Microservice Python FastAPI xử lý thị giác máy tính (YOLOv8 + PaddleOCR).
/// Tích hợp cơ chế dự phòng đa tầng (Multi-tier Vision Fallback):
/// 1. Microservice Python YOLOv8 + PaddleOCR cục bộ (cổng 8000).
/// 2. Google Gemini Generative Vision API (Multimodal LLM) nhận diện biển số xe độ chính xác cao.
/// 3. Bộ mô phỏng AI Fallback an toàn (Smart Rule-based Simulator) chống sập hệ thống.
/// </summary>
public partial class PythonFastApiClient(
    HttpClient httpClient,
    IConfiguration configuration,
    ILogger<PythonFastApiClient> logger)
{
    /// <summary>
    /// Địa chỉ base URL của dịch vụ Python AI Vision (mặc định http://localhost:8000 nếu không cấu hình trong appsettings.json)
    /// </summary>
    private readonly string _serviceUrl = configuration["AiVision:ServiceUrl"] ?? "http://localhost:8000";

    [GeneratedRegex(@"^\d{2}([A-Z]{1,2}|[A-Z]\d)\d{4,5}$")]
    private static partial Regex ValidVietnamesePlateRegex();

    private static bool IsCompleteVietnamesePlate(string? rawPlate)
    {
        if (string.IsNullOrWhiteSpace(rawPlate)) return false;
        var clean = Regex.Replace(rawPlate.ToUpperInvariant(), @"[^A-Z0-9]", "");
        return ValidVietnamesePlateRegex().IsMatch(clean);
    }

    /// <summary>
    /// Gửi mảng byte ảnh tới pipeline AI nhận diện biển số.
    /// Ưu tiên: Python FastAPI (nếu đọc ra biển hợp lệ) -> Gemini Multimodal Vision -> Unrecognized Fallback (không sinh biển số ảo).
    /// </summary>
    /// <param name="imageBytes">Mảng byte thô của ảnh cần quét biển số</param>
    /// <param name="ct">Mã thông báo hủy tác vụ bất đồng bộ (<see cref="CancellationToken"/>)</param>
    /// <returns>Đối tượng <see cref="PythonPlateDetectionResponse"/> chứa biển số nhận diện, độ tin cậy và cờ IsFallback</returns>
    public async Task<PythonPlateDetectionResponse> DetectPlateAsync(byte[] imageBytes, CancellationToken ct = default)
    {
        var targetUrl = $"{_serviceUrl.TrimEnd('/')}/detect-plate";
        PythonPlateDetectionResponse? partialPythonResult = null;

        // Bước 1: Thử gọi Python AI Vision Microservice (YOLOv8 + PaddleOCR) nếu đang trực tuyến
        try
        {
            using var content = new MultipartFormDataContent();
            var imageContent = new ByteArrayContent(imageBytes);
            var mime = IsPng(imageBytes) ? "image/png" : "image/jpeg";
            imageContent.Headers.ContentType = MediaTypeHeaderValue.Parse(mime);
            content.Add(imageContent, "file", IsPng(imageBytes) ? "plate_input.png" : "plate_input.jpg");

            var response = await httpClient.PostAsync(targetUrl, content, ct);

            if (response.IsSuccessStatusCode)
            {
                var json = await response.Content.ReadAsStringAsync(ct);
                var result = JsonSerializer.Deserialize<PythonPlateDetectionResponse>(json, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });

                if (result != null && IsCompleteVietnamesePlate(result.PlateText))
                {
                    return result with { IsFallback = false };
                }

                if (result != null && !string.IsNullOrWhiteSpace(result.PlateText))
                {
                    partialPythonResult = result;
                    logger.LogInformation("Python OCR chỉ đọc được một phần biển số ('{Partial}'), chuyển sang Gemini Vision AI để đọc biển 2 dòng chính xác hơn.", result.PlateText);
                }
            }
            else
            {
                logger.LogWarning("Python AI Vision service responded with status {StatusCode}", response.StatusCode);
            }
        }
        catch (Exception ex) when (!ct.IsCancellationRequested && ex is (HttpRequestException or TaskCanceledException or SocketException))
        {
            logger.LogWarning(ex, "Không thể kết nối đến Python FastAPI tại {Url}. Chuyển sang cơ chế Vision AI dự phòng.", targetUrl);
        }

        // Bước 2: Tự động gọi Gemini Multimodal Vision AI (đặc biệt hiệu quả với biển số 2 dòng xe máy / ô tô vuông)
        try
        {
            var geminiResult = await TryDetectViaGeminiVisionAsync(imageBytes, ct);
            if (geminiResult != null && !string.IsNullOrWhiteSpace(geminiResult.PlateText))
            {
                logger.LogInformation("Nhận diện biển số thành công qua Gemini Vision AI: {Plate} ({PlateType})", geminiResult.PlateText, geminiResult.PlateType);
                return geminiResult with
                {
                    CroppedImageBase64 = geminiResult.CroppedImageBase64 ?? partialPythonResult?.CroppedImageBase64
                };
            }
        }
        catch (Exception geminiEx)
        {
            logger.LogWarning(geminiEx, "Lỗi khi gọi Gemini Vision AI.");
        }

        // Nếu Python OCR có đọc được kết quả hợp lệ một phần và Gemini không khả dụng
        if (partialPythonResult != null && IsCompleteVietnamesePlate(partialPythonResult.PlateText))
        {
            return partialPythonResult with { IsFallback = false };
        }

        // Bước 3: Trả trạng thái không nhận diện được (Tuyệt đối không sinh biển số giả/ảo gây nhầm lẫn cho vận hành)
        return GenerateUnrecognizedFallback(imageBytes, partialPythonResult?.CroppedImageBase64);
    }

    private static bool IsPng(byte[] bytes) =>
        bytes.Length >= 8 &&
        bytes[0] == 0x89 && bytes[1] == 0x50 && bytes[2] == 0x4E && bytes[3] == 0x47;

    /// <summary>
    /// Gọi Gemini Vision API để bóc tách biển số xe (cả biển 1 dòng và biển 2 dòng) trực tiếp từ mảng byte ảnh JPEG/PNG.
    /// </summary>
    private async Task<PythonPlateDetectionResponse?> TryDetectViaGeminiVisionAsync(byte[] imageBytes, CancellationToken ct)
    {
        var apiKey = configuration["Gemini:ApiKey"] ?? configuration["AI:GeminiApiKey"] ?? string.Empty;
        var model = configuration["Gemini:Model"] ?? "gemini-2.5-flash";
        if (string.IsNullOrWhiteSpace(apiKey)) return null;

        var endpoint = $"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}";
        var base64Image = Convert.ToBase64String(imageBytes);
        var mimeType = IsPng(imageBytes) ? "image/png" : "image/jpeg";

        var prompt = """
            You are a high-accuracy Vietnamese Vehicle License Plate (ANPR/ALPR) OCR system.
            Carefully read the vehicle license plate in the image.
            Pay special attention to TWO-LINE (2 dòng / square) Vietnamese license plates:
            - Top line contains: 2-digit province code + series (e.g., "78-AL", "59-AA", "59-P1", "29-H1", "51A", "30H").
            - Bottom line contains: 4 or 5 digits (e.g., "123.45", "678.90", "1234").
            - You MUST combine both the top line and bottom line into a single complete license plate string!
            Supported Vietnamese formats:
            - Motorbikes (New 2-letter series Circular 24/2023, 2 lines): "78-AL 123.45", "59-AA 999.99"
            - Motorbikes (Legacy 1-letter + 1-digit series, 2 lines): "59-P1 123.45", "29-H1 678.90"
            - Cars (1 line or 2 lines): "51K-888.88", "18A-410.83", "51LD-123.45"
            If no license plate is visible or readable in the image, return "plate_text": "" and "confidence": 0.0. Never guess or invent a random plate!
            Return ONLY a valid JSON object with exact keys:
            {
              "plate_text": "string (e.g. 78-AL 123.45 or 51K-888.88, or empty if unreadable)",
              "confidence": 0.95,
              "plate_type": "TwoLine" or "OneLine"
            }
            """;

        var requestBody = new
        {
            contents = new[]
            {
                new
                {
                    parts = new object[]
                    {
                        new { text = prompt },
                        new
                        {
                            inline_data = new
                            {
                                mime_type = mimeType,
                                data = base64Image
                            }
                        }
                    }
                }
            },
            generationConfig = new
            {
                temperature = 0.1,
                maxOutputTokens = 1024,
                responseMimeType = "application/json"
            }
        };

        var jsonPayload = JsonSerializer.Serialize(requestBody);
        using var requestContent = new StringContent(jsonPayload, Encoding.UTF8, "application/json");
        var response = await httpClient.PostAsync(endpoint, requestContent, ct);
        if (!response.IsSuccessStatusCode)
        {
            logger.LogWarning("Gemini Vision API returned status {StatusCode}", response.StatusCode);
            return null;
        }

        var responseJson = await response.Content.ReadAsStringAsync(ct);
        using var doc = JsonDocument.Parse(responseJson);
        if (doc.RootElement.TryGetProperty("candidates", out var candidates) &&
            candidates.GetArrayLength() > 0 &&
            candidates[0].TryGetProperty("content", out var cContent) &&
            cContent.TryGetProperty("parts", out var parts) &&
            parts.GetArrayLength() > 0)
        {
            string rawText = string.Empty;
            foreach (var part in parts.EnumerateArray())
            {
                if (part.TryGetProperty("thought", out var thoughtProp) && thoughtProp.ValueKind == JsonValueKind.True)
                {
                    continue;
                }
                if (part.TryGetProperty("text", out var textElem))
                {
                    var candidateText = textElem.GetString();
                    if (!string.IsNullOrWhiteSpace(candidateText))
                    {
                        rawText = candidateText;
                    }
                }
            }

            if (string.IsNullOrWhiteSpace(rawText)) return null;

            var cleanJson = rawText.Trim();
            if (cleanJson.StartsWith("```json", StringComparison.OrdinalIgnoreCase)) cleanJson = cleanJson[7..];
            else if (cleanJson.StartsWith("```", StringComparison.OrdinalIgnoreCase)) cleanJson = cleanJson[3..];
            if (cleanJson.EndsWith("```", StringComparison.OrdinalIgnoreCase)) cleanJson = cleanJson[..^3];
            cleanJson = cleanJson.Trim();

            using var plateDoc = JsonDocument.Parse(cleanJson);
            var root = plateDoc.RootElement;
            var plateText = root.TryGetProperty("plate_text", out var pt) ? pt.GetString() ?? "" : "";
            var confidence = root.TryGetProperty("confidence", out var cf) && cf.TryGetDouble(out var parsedConf) ? parsedConf : 0.95;
            var plateType = root.TryGetProperty("plate_type", out var pty) ? pty.GetString() ?? "OneLine" : "OneLine";

            if (!string.IsNullOrWhiteSpace(plateText) && confidence >= 0.50)
            {
                return new PythonPlateDetectionResponse
                {
                    PlateText = plateText.ToUpperInvariant().Trim(),
                    Confidence = confidence,
                    PlateType = plateType,
                    IsFallback = false,
                    Status = "valid",
                    FormatValid = true
                };
            }
        }
        return null;
    }

    /// <summary>
    /// Trả về phản hồi không nhận diện được khi cả Python OCR và Gemini Vision đều không đọc được biển số.
    /// Tuyệt đối không sinh biển số ngẫu nhiên từ mã băm SHA256 để tránh hiển thị biển số ảo trên giao diện vận hành.
    /// </summary>
    private PythonPlateDetectionResponse GenerateUnrecognizedFallback(byte[] imageBytes, string? croppedBase64 = null)
    {
        logger.LogWarning("Không thể nhận diện biển số từ ảnh ({Bytes} bytes). Yêu cầu nhân viên chụp lại hoặc nhập thủ công.", imageBytes.Length);
        return new PythonPlateDetectionResponse
        {
            PlateText = string.Empty,
            Confidence = 0.0,
            PlateType = "OneLine",
            CroppedImageBase64 = croppedBase64,
            IsFallback = true,
            Status = "unrecognized",
            FormatValid = false
        };
    }
}
