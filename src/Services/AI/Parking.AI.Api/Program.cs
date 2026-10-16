using Microsoft.AspNetCore.Mvc;
using Parking.AI.Application;
using Parking.AI.Application.DTOs.Assistant;
using Parking.AI.Application.DTOs.LicensePlate;
using Parking.AI.Application.DTOs.ParkingSearch;
using Parking.AI.Application.Interfaces;
using Parking.AI.Infrastructure;
using Parking.AI.Infrastructure.AiVision;
using Parking.AI.Infrastructure.GenAi;
using Parking.Contracts.Identity.V1;
using Parking.ServiceDefaults;

var builder = WebApplication.CreateBuilder(args);
builder.AddParkingDefaults();

builder.Services.AddHttpClient<IPlateProvider, HttpPlateProvider>(http => http.Timeout = TimeSpan.FromSeconds(10));
builder.Services.AddHttpClient<PythonFastApiClient>(http => http.Timeout = TimeSpan.FromSeconds(15));
builder.Services.AddHttpClient<GeminiApiClient>(http => http.Timeout = TimeSpan.FromSeconds(20));

builder.Services.AddScoped<AIReadService>();
builder.Services.AddScoped<ILicensePlateRecognitionService, LicensePlateRecognitionService>();
builder.Services.AddSingleton<IParkingAssistantService, ParkingAssistantService>();
builder.Services.AddScoped<IParkingSearchAiService, ParkingSearchAiService>();

builder.Services.AddGrpcClient<FacilityAuthorization.FacilityAuthorizationClient>(o =>
    o.Address = new Uri(builder.Configuration["Services:IdentityGrpc"] ?? "http://identity:8081"));

var app = builder.Build();
app.UseParkingDefaults("ai");

app.MapGrpcService<PlateRecognitionGrpc>();
app.MapGrpcService<OccupancyIngestionGrpc>();

// 1. Quản lý dự báo công suất bãi đỗ
app.MapGet("/api/v1/parking-lots/{lotId:guid}/occupancy-forecasts", async (Guid lotId, string vehicleType, int horizonMinutes, AIReadService service, CancellationToken ct) =>
    Responses.Ok(await service.ForecastAsync(lotId, vehicleType, horizonMinutes, ct)))
    .WithSummary("Dự báo công suất sử dụng bãi xe theo khung thời gian (30/60/120 phút)")
    .WithTags("AI Occupancy Forecast");

// 2. Trợ lý tra cứu tài liệu quy chế / FAQ nội bộ bãi xe (Document Retrieval thuần túy không dùng LLM)
app.MapPost("/api/v1/parking-lots/{lotId:guid}/assistant", async (Guid lotId, AssistantRequest request, AIReadService service, CancellationToken ct) =>
    Responses.Ok(await service.AssistantAsync(lotId, request.Question, ct)))
    .WithSummary("Tra cứu FAQ / Quy định bãi xe theo từ khóa (Document Retrieval từ tài liệu đã duyệt, không dùng LLM)")
    .WithTags("AI Assistant FAQ (No-LLM)");

// 3. Quản lý tài liệu tri thức AI
app.MapPost("/api/v1/ai/documents", async (DocumentRequest request, HttpContext context, FacilityAuthorization.FacilityAuthorizationClient identity, AIReadService service, CancellationToken ct) =>
{
    await Require(context.User.Subject(), Guid.Empty, "ADMIN", identity, ct);
    return Responses.Ok(new { id = await service.CreateDocumentAsync(context.User.Subject(), request, ct) });
}).RequireAuthorization()
.WithSummary("Tạo tài liệu tri thức mới cho trợ lý AI (Chế độ DRAFT, yêu cầu quyền ADMIN)")
.WithTags("AI Knowledge Management");

app.MapPost("/api/v1/ai/documents/{id:guid}/publish", async (Guid id, PublishRequest request, HttpContext context, FacilityAuthorization.FacilityAuthorizationClient identity, AIReadService service, CancellationToken ct) =>
{
    await Require(context.User.Subject(), Guid.Empty, "ADMIN", identity, ct);
    if (!request.ConfirmPublicContentReviewed) throw new ServiceException(400, "Explicit public-content review confirmation required");
    await service.PublishAsync(context.User.Subject(), id, request.Version, ct);
    return Responses.Ok(new { id, status = "PUBLISHED" });
}).RequireAuthorization()
.WithSummary("Duyệt và xuất bản tài liệu tri thức AI sang trạng thái PUBLISHED")
.WithTags("AI Knowledge Management");

app.MapPost("/api/v1/parking-lots/{lotId:guid}/plate-recognitions/{id:guid}/review", async (Guid lotId, Guid id, PlateReviewRequest request, HttpContext context, FacilityAuthorization.FacilityAuthorizationClient identity, AIReadService service, CancellationToken ct) =>
{
    await Require(context.User.Subject(), lotId, "OCR", identity, ct);
    await service.ReviewAsync(context.User.Subject(), lotId, id, request, ct);
    return Responses.Ok(new { id, status = "REVIEWED" });
}).RequireAuthorization()
.WithSummary("Soát xét và cập nhật biển số xe OCR thủ công từ nhân viên bãi xe")
.WithTags("AI Vision ANPR OCR");

// 4. Mở rộng tính năng AI Extension: Nhận diện biển số xe (ANPR OCR)
app.MapPost("/api/v1/ai/license-plate/scan", async (HttpRequest httpRequest, HttpContext httpContext, ILicensePlateRecognitionService service, CancellationToken ct) =>
{
    Guid? uploadedBy = Guid.TryParse(httpContext.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? httpContext.User.FindFirst("sub")?.Value, out var uid) ? uid : null;

    if (httpRequest.HasFormContentType)
    {
        var form = await httpRequest.ReadFormAsync(ct);
        var file = form.Files.GetFile("file");
        var gateId = form["gateId"].ToString();
        var direction = form["direction"].ToString();
        var lotIdStr = form["parkingLotId"].ToString();
        var idempotencyKey = form["idempotencyKey"].ToString();
        Guid? lotId = Guid.TryParse(lotIdStr, out var parsedLotId) ? parsedLotId : null;

        if (file == null || file.Length == 0)
            return Responses.Error(400, "Vui lòng đính kèm file ảnh trong form data.");

        if (file.Length > Parking.AI.Domain.ImageRules.MaxImageBytes)
            return Responses.Error(400, $"Kích thước ảnh vượt quá giới hạn cho phép ({Parking.AI.Domain.ImageRules.MaxImageBytes / 1024 / 1024}MB).");

        using var ms = new MemoryStream();
        await file.CopyToAsync(ms, ct);
        var bytes = ms.ToArray();

        // Kiểm tra định dạng ảnh hợp lệ (PNG / JPEG magic bytes: DEF-08)
        if (!Parking.AI.Domain.ImageRules.IsSupported(bytes, file.ContentType))
            return Responses.Error(400, "Định dạng file không được hỗ trợ. Chỉ chấp nhận ảnh PNG hoặc JPEG hợp lệ.");

        var result = await service.RecognizePlateFromBytesAsync(
            bytes,
            string.IsNullOrWhiteSpace(gateId) ? "GATE_IN_01" : gateId,
            string.IsNullOrWhiteSpace(direction) ? "IN" : direction,
            lotId,
            string.IsNullOrWhiteSpace(idempotencyKey) ? null : idempotencyKey,
            uploadedBy,
            ct);

        return Responses.Ok(result, "Nhận diện biển số xe thành công.");
    }

    var request = await httpRequest.ReadFromJsonAsync<PlateRecognitionRequestDto>(cancellationToken: ct);
    if (request == null || string.IsNullOrWhiteSpace(request.ImageBase64))
        return Responses.Error(400, "Yêu cầu chuỗi Base64 imageBase64 hoặc form-data file.");

    if (request.UploadedBy == null && uploadedBy != null)
        request = request with { UploadedBy = uploadedBy };

    var jsonResult = await service.RecognizePlateAsync(request, ct);
    return Responses.Ok(jsonResult, "Nhận diện biển số xe thành công.");
})
.WithSummary("Quét và nhận diện biển số xe (ANPR OCR) qua File Upload hoặc Base64 JSON")
.WithTags("AI Vision ANPR OCR");

// 5. Mở rộng tính năng AI Extension: Trợ lý ảo AI Chat (Contextual Assistant)
app.MapPost("/api/v1/ai/assistant/chat", async (AssistantChatRequestDto request, HttpContext httpContext, IParkingAssistantService service, CancellationToken ct) =>
{
    if (string.IsNullOrWhiteSpace(request.Message))
        return Responses.Error(400, "Nội dung tin nhắn 'message' không được để trống.");

    if (request.Message.Length > 1000)
        return Responses.Error(400, "Nội dung tin nhắn không được vượt quá 1000 ký tự.");

    var userId = httpContext.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
        ?? httpContext.User.FindFirst("sub")?.Value
        ?? request.UserId;
    if (!string.IsNullOrWhiteSpace(userId) && request.UserId == null)
        request = request with { UserId = userId };

    var reply = await service.ChatAsync(request, ct);
    return Responses.Ok(reply, "Trợ lý AI đã trả lời thành công.");
})
.WithSummary("Trò chuyện cùng Trợ lý ảo AI đàm thoại đa lượt (Có LLM Gemini + Domain Guardrails)")
.WithTags("AI Conversational Assistant");

app.MapDelete("/api/v1/ai/assistant/session/{sessionId:guid}", async (Guid sessionId, IParkingAssistantService service, CancellationToken ct) =>
{
    var ok = await service.ResetSessionAsync(sessionId, ct);
    return Responses.Ok(ok, ok ? "Đã làm mới phiên hội thoại thành công." : "Phiên hội thoại không tồn tại.");
})
.WithSummary("Làm mới hoặc xóa phiên hội thoại của trợ lý AI")
.WithTags("AI Conversational Assistant");

// 6. Mở rộng tính năng AI Extension: Tìm kiếm bãi xe thông minh (Smart Search & Recommendations)
app.MapPost("/api/v1/ai/parking/smart-search", async (SearchParkingSmartQuery query, IParkingSearchAiService service, CancellationToken ct) =>
{
    if (string.IsNullOrWhiteSpace(query.NaturalLanguagePrompt))
        return Responses.Error(400, "Nội dung tìm kiếm 'naturalLanguagePrompt' không được để trống.");

    if (query.NaturalLanguagePrompt.Length > 500)
        return Responses.Error(400, "Nội dung câu tìm kiếm không được vượt quá 500 ký tự.");

    var result = await service.SmartSearchAsync(query.NaturalLanguagePrompt, query.UserCurrentLatitude, query.UserCurrentLongitude, ct);
    return Responses.Ok(result, "Tìm kiếm và phân tích bãi xe thông minh thành công.");
})
.WithSummary("Tìm kiếm bãi đỗ xe thông minh bằng câu lệnh ngôn ngữ tự nhiên (Natural Language Search)")
.WithTags("AI Smart Parking Search");

app.MapPost("/api/v1/ai/parking/recommend", async (SmartSearchCriteriaDto criteria, IParkingSearchAiService service, CancellationToken ct) =>
{
    var result = await service.RecommendParkingAsync(criteria, ct);
    return Responses.Ok(result, "Gợi ý bãi xe thành công.");
})
.WithSummary("Gợi ý danh sách bãi xe tối ưu dựa trên tiêu chí khoảng cách, giá vé (Rule 7) và công suất")
.WithTags("AI Smart Parking Search");

await app.RunAsync();

async Task Require(Guid user, Guid lot, string capability, FacilityAuthorization.FacilityAuthorizationClient identity, CancellationToken ct)
{
    var reply = await identity.CheckAccessAsync(new AccessRequest { UserId = user.ToString(), LotId = lot.ToString(), Capability = capability }, headers: GrpcHeaders.For(builder.Configuration), deadline: DateTime.UtcNow.AddSeconds(3), cancellationToken: ct);
    if (!reply.Allowed) throw new ServiceException(403, "Current account/lot permission denied");
}

public sealed record PublishRequest(int Version, bool ConfirmPublicContentReviewed);
public partial class Program;
