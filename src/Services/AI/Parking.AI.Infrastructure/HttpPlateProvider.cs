using System.Net.Http.Json;
using Microsoft.Extensions.Configuration;
using Parking.AI.Application;
using Parking.AI.Domain;
using Parking.ServiceDefaults;

namespace Parking.AI.Infrastructure;

/// <summary>
/// Nhà cung cấp dịch vụ nhận diện biển số xe qua HTTP Client (kết nối tới OCR Service bên ngoài hoặc ai-vision service).
/// Áp dụng các nguyên tắc phòng thủ mạng: Bắt buộc HTTPS trên Production, giới hạn kích thước Payload để chống tràn RAM.
/// </summary>
/// <param name="http">Instance <see cref="HttpClient"/> được quản lý tập trung qua IHttpClientFactory để tái sử dụng socket.</param>
/// <param name="config">Giao diện <see cref="IConfiguration"/> đọc cấu hình từ appsettings hoặc biến môi trường.</param>
public sealed class HttpPlateProvider(HttpClient http, IConfiguration config) : IPlateProvider
{
    /// <summary>
    /// Gửi dữ liệu ảnh đã mã hóa Base64 tới máy chủ OCR để nhận diện biển số xe.
    /// </summary>
    /// <param name="image">Mảng byte nhị phân của file ảnh.</param>
    /// <param name="contentType">Định dạng ảnh MIME type (VD: image/png, image/jpeg).</param>
    /// <param name="ct">Token hủy tác vụ bất đồng bộ <see cref="CancellationToken"/> khi request bị ngắt.</param>
    /// <returns>Đối tượng <see cref="PlateCandidate"/> chứa biển số nhận diện, độ tin cậy và phiên bản model.</returns>
    /// <exception cref="ServiceException">Ném lỗi HTTP 503 nếu OCR provider chưa cấu hình, không khả dụng hoặc trả về dữ liệu bất thường.</exception>
    public async Task<PlateCandidate> RecognizeAsync(byte[] image, string contentType, CancellationToken ct)
    {
        // 1. Kiểm tra cấu hình URL endpoint của dịch vụ OCR
        if (!Uri.TryCreate(config["AI:OcrEndpoint"], UriKind.Absolute, out var endpoint))
            throw new ServiceException(503, "OCR provider is not configured");

        // 2. Kiểm tra an toàn kênh truyền: Production bắt buộc dùng HTTPS (chỉ cho phép HTTP trên môi trường Development)
        if (endpoint.Scheme != "https" && !(config["ASPNETCORE_ENVIRONMENT"] == "Development" && endpoint.Scheme == "http"))
            throw new ServiceException(503, "OCR provider requires HTTPS");

        // 3. Đóng gói dữ liệu ảnh dưới dạng Base64 gửi đi trong body JSON
        // Thư viện: JsonContent.Create tự động serialize object sang JSON UTF-8 và gắn header application/json
        using var request = new HttpRequestMessage(HttpMethod.Post, endpoint)
        {
            Content = JsonContent.Create(new { imageBase64 = Convert.ToBase64String(image), contentType })
        };

        // Gắn API Key xác thực nếu nhà cung cấp yêu cầu
        var apiKey = config["AI:OcrApiKey"];
        if (!string.IsNullOrEmpty(apiKey))
        {
            request.Headers.TryAddWithoutValidation("X-Api-Key", apiKey);
        }

        // 4. Gửi HTTP Request bất đồng bộ
        using var response = await http.SendAsync(request, ct);

        // Giới hạn phản hồi tối đa 16KB (16 * 1024 bytes) để chống tấn công làm cạn kiệt bộ nhớ RAM
        if (!response.IsSuccessStatusCode || response.Content.Headers.ContentLength > 16 * 1024)
            throw new ServiceException(503, "OCR provider unavailable");

        // 5. Đọc Stream phản hồi theo từng khối buffer có chặn cận trên (Bounded Stream Reading)
        // Mục đích: Nếu server trả về response chunked không có Content-Length, ta vẫn chủ động ngắt kết nối nếu vượt quá 16KB
        await using var stream = await response.Content.ReadAsStreamAsync(ct);
        using var buffer = new MemoryStream();
        var bytes = new byte[4096];
        int n;
        while ((n = await stream.ReadAsync(bytes, ct)) > 0)
        {
            if (buffer.Length + n > 16 * 1024)
                throw new ServiceException(503, "Invalid OCR response (kích thước payload phản hồi vượt quá 16KB)");
            await buffer.WriteAsync(bytes.AsMemory(0, n), ct);
        }

        // Đưa con trỏ đọc về đầu MemoryStream để chuẩn bị parse JSON
        buffer.Position = 0;

        // 6. Deserialize luồng dữ liệu JSON sang object PlateCandidate
        var candidate = await System.Text.Json.JsonSerializer.DeserializeAsync<PlateCandidate>(buffer,
            new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true }, ct);

        // 7. Phòng vệ nghiêm ngặt tính toàn vẹn của kết quả OCR (Defensive Invariant Validation)
        if (candidate is null || string.IsNullOrWhiteSpace(candidate.ModelVersion) || candidate.ModelVersion.Length > 128
            || (candidate.Plate is not null && (!ImageRules.IsNormalizedPlate(candidate.Plate) || candidate.Confidence is null or < 0 or > 1 || !double.IsFinite(candidate.Confidence.Value)))
            || (candidate.Plate is null && candidate.Confidence is not null))
        {
            throw new ServiceException(503, "Invalid OCR response (kết quả OCR không hợp lệ hoặc vi phạm ràng buộc dữ liệu)");
        }

        return candidate;
    }
}

