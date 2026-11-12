using Parking.ServiceDefaults;
using System.Net.Http.Headers;
using System.Net.Sockets;
using System.Text.Json;
using System.Text.Json.Serialization;
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
/// <para>
/// <b>Thư viện & Công nghệ sử dụng:</b>
/// <list type="bullet">
///   <item><description><see cref="HttpClient"/>: Được cấp phát từ IHttpClientFactory nhằm tái sử dụng socket pool và ngăn ngừa cạn kiệt socket (Socket Exhaustion).</description></item>
///   <item><description><see cref="MultipartFormDataContent"/>: Đóng gói dữ liệu dạng multipart/form-data tương đương thẻ form HTML upload file.</description></item>
///   <item><description><see cref="ByteArrayContent"/>: Bọc mảng byte thô của file ảnh với header Content-Type tương ứng (image/jpeg).</description></item>
///   <item><description><see cref="JsonSerializer"/>: Giải mã chuỗi JSON từ Python về DTO C# với tùy chọn không phân biệt chữ hoa/thường.</description></item>
///   <item><description><b>Exception Filter (when):</b> Kỹ thuật bắt chọn lọc nhóm ngoại lệ mạng (HttpRequestException, TaskCanceledException, SocketException) để kích hoạt fallback an toàn mà không che giấu các lỗi nghiêm trọng khác.</description></item>
/// </list>
/// </para>
/// </summary>
public class PythonFastApiClient(
    HttpClient httpClient,
    IConfiguration configuration,
    ILogger<PythonFastApiClient> logger)
{
    /// <summary>
    /// Địa chỉ base URL của dịch vụ Python AI Vision (mặc định http://localhost:8000 nếu không cấu hình trong appsettings.json)
    /// </summary>
    private readonly string _serviceUrl = configuration["AiVision:ServiceUrl"] ?? "http://localhost:8000";

    /// <summary>
    /// Gửi mảng byte ảnh tới endpoint Python <c>/detect-plate</c> bằng giao thức HTTP POST Multipart Form-Data.
    /// Nếu dịch vụ Python không khả dụng, phương thức trả lỗi để nhân viên xác minh thủ công.
    /// </summary>
    /// <param name="imageBytes">Mảng byte thô của ảnh cần quét biển số</param>
    /// <param name="ct">Mã thông báo hủy tác vụ bất đồng bộ (<see cref="CancellationToken"/>)</param>
    /// <returns>Đối tượng <see cref="PythonPlateDetectionResponse"/> chứa biển số nhận diện, độ tin cậy và cờ IsFallback</returns>
    public async Task<PythonPlateDetectionResponse> DetectPlateAsync(byte[] imageBytes, CancellationToken ct = default)
    {
        var targetUrl = $"{_serviceUrl.TrimEnd('/')}/detect-plate";

        try
        {
            // MultipartFormDataContent: Đóng gói mảng byte của ảnh thành 1 phần file tải lên (form-data)
            using var content = new MultipartFormDataContent();
            var imageContent = new ByteArrayContent(imageBytes);
            imageContent.Headers.ContentType = MediaTypeHeaderValue.Parse("image/jpeg");
            content.Add(imageContent, "file", "plate_input.jpg");

            // Thực hiện gọi HTTP POST sang Python FastAPI
            var response = await httpClient.PostAsync(targetUrl, content, ct);

            if (response.IsSuccessStatusCode)
            {
                var json = await response.Content.ReadAsStringAsync(ct);
                var result = JsonSerializer.Deserialize<PythonPlateDetectionResponse>(json, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true // Không phân biệt hoa/thường giữa snake_case và PascalCase
                });

                // Sử dụng cú pháp 'with' (non-destructive mutation) của C# Record để đánh dấu kết quả thực tế từ AI
                if (result != null) return result with { IsFallback = false };
            }

            logger.LogWarning("Python AI Vision service responded with status {StatusCode}", response.StatusCode);
        }
        catch (Exception ex) when (!ct.IsCancellationRequested && ex is (HttpRequestException or TaskCanceledException or SocketException))
        {
            // Exception Filter: Chỉ bắt các lỗi mất mạng, timeout hoặc server Python chưa bật
            logger.LogWarning(ex, "Không thể kết nối đến Python FastAPI tại {Url}. Yêu cầu nhân viên xác minh thủ công.", targetUrl);
        }

        throw new ServiceException(503, "Không thể nhận diện biển số lúc này. Vui lòng xác minh và nhập biển số thủ công.");
    }
}
