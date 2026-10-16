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
    Responses.Ok(await service.ForecastAsync(lotId, vehicleType, horizonMinutes, ct)));

// 2. Trợ lý AI theo bãi đỗ
app.MapPost("/api/v1/parking-lots/{lotId:guid}/assistant", async (Guid lotId, AssistantRequest request, AIReadService service, CancellationToken ct) =>
    Responses.Ok(await service.AssistantAsync(lotId, request.Question, ct)));

// 3. Quản lý tài liệu tri thức AI
app.MapPost("/api/v1/ai/documents", async (DocumentRequest request, HttpContext context, FacilityAuthorization.FacilityAuthorizationClient identity, AIReadService service, CancellationToken ct) =>
{
    await Require(context.User.Subject(), Guid.Empty, "ADMIN", identity, ct);
    return Responses.Ok(new { id = await service.CreateDocumentAsync(context.User.Subject(), request, ct) });
}).RequireAuthorization();

app.MapPost("/api/v1/ai/documents/{id:guid}/publish", async (Guid id, PublishRequest request, HttpContext context, FacilityAuthorization.FacilityAuthorizationClient identity, AIReadService service, CancellationToken ct) =>
{
    await Require(context.User.Subject(), Guid.Empty, "ADMIN", identity, ct);
    if (!request.ConfirmPublicContentReviewed) throw new ServiceException(400, "Explicit public-content review confirmation required");
    await service.PublishAsync(context.User.Subject(), id, request.Version, ct);
    return Responses.Ok(new { id, status = "PUBLISHED" });
}).RequireAuthorization();

app.MapPost("/api/v1/parking-lots/{lotId:guid}/plate-recognitions/{id:guid}/review", async (Guid lotId, Guid id, PlateReviewRequest request, HttpContext context, FacilityAuthorization.FacilityAuthorizationClient identity, AIReadService service, CancellationToken ct) =>
{
    await Require(context.User.Subject(), lotId, "OCR", identity, ct);
    await service.ReviewAsync(context.User.Subject(), lotId, id, request, ct);
    return Responses.Ok(new { id, status = "REVIEWED" });
}).RequireAuthorization();

// 4. Mở rộng tính năng AI Extension: Nhận diện biển số xe (ANPR OCR)
app.MapPost("/api/v1/ai/license-plate/scan", async (HttpRequest httpRequest, ILicensePlateRecognitionService service, CancellationToken ct) =>
{
    if (httpRequest.HasFormContentType)
    {
        var form = await httpRequest.ReadFormAsync(ct);
        var file = form.Files.GetFile("file");
        var gateId = form["gateId"].ToString();
        var direction = form["direction"].ToString();
        var lotIdStr = form["parkingLotId"].ToString();
        Guid? lotId = Guid.TryParse(lotIdStr, out var parsedLotId) ? parsedLotId : null;

        if (file == null || file.Length == 0)
            return Responses.Error(400, "Vui lòng đính kèm file ảnh trong form data.");

        using var ms = new MemoryStream();
        await file.CopyToAsync(ms, ct);
        var result = await service.RecognizePlateFromBytesAsync(ms.ToArray(), string.IsNullOrWhiteSpace(gateId) ? "GATE_IN_01" : gateId, string.IsNullOrWhiteSpace(direction) ? "IN" : direction, lotId, ct);
        return Responses.Ok(result, "Nhận diện biển số xe thành công.");
    }

    var request = await httpRequest.ReadFromJsonAsync<PlateRecognitionRequestDto>(cancellationToken: ct);
    if (request == null || string.IsNullOrWhiteSpace(request.ImageBase64))
        return Responses.Error(400, "Yêu cầu chuỗi Base64 imageBase64 hoặc form-data file.");

    var jsonResult = await service.RecognizePlateAsync(request, ct);
    return Responses.Ok(jsonResult, "Nhận diện biển số xe thành công.");
});

// 5. Mở rộng tính năng AI Extension: Trợ lý ảo AI Chat (Contextual Assistant)
app.MapPost("/api/v1/ai/assistant/chat", async (AssistantChatRequestDto request, IParkingAssistantService service, CancellationToken ct) =>
{
    if (string.IsNullOrWhiteSpace(request.Message))
        return Responses.Error(400, "Nội dung tin nhắn 'message' không được để trống.");

    var reply = await service.ChatAsync(request, ct);
    return Responses.Ok(reply, "Trợ lý AI đã trả lời thành công.");
});

app.MapDelete("/api/v1/ai/assistant/session/{sessionId:guid}", async (Guid sessionId, IParkingAssistantService service, CancellationToken ct) =>
{
    var ok = await service.ResetSessionAsync(sessionId, ct);
    return Responses.Ok(ok, ok ? "Đã làm mới phiên hội thoại thành công." : "Phiên hội thoại không tồn tại.");
});

// 6. Mở rộng tính năng AI Extension: Tìm kiếm bãi xe thông minh (Smart Search & Recommendations)
app.MapPost("/api/v1/ai/parking/smart-search", async (SearchParkingSmartQuery query, IParkingSearchAiService service, CancellationToken ct) =>
{
    if (string.IsNullOrWhiteSpace(query.NaturalLanguagePrompt))
        return Responses.Error(400, "Nội dung tìm kiếm 'naturalLanguagePrompt' không được để trống.");

    var result = await service.SmartSearchAsync(query.NaturalLanguagePrompt, query.UserCurrentLatitude, query.UserCurrentLongitude, ct);
    return Responses.Ok(result, "Tìm kiếm và phân tích bãi xe thông minh thành công.");
});

app.MapPost("/api/v1/ai/parking/recommend", async (SmartSearchCriteriaDto criteria, IParkingSearchAiService service, CancellationToken ct) =>
{
    var result = await service.RecommendParkingAsync(criteria, ct);
    return Responses.Ok(result, "Gợi ý bãi xe thành công.");
});

await app.RunAsync();

async Task Require(Guid user, Guid lot, string capability, FacilityAuthorization.FacilityAuthorizationClient identity, CancellationToken ct)
{
    var reply = await identity.CheckAccessAsync(new AccessRequest { UserId = user.ToString(), LotId = lot.ToString(), Capability = capability }, headers: GrpcHeaders.For(builder.Configuration), deadline: DateTime.UtcNow.AddSeconds(3), cancellationToken: ct);
    if (!reply.Allowed) throw new ServiceException(403, "Current account/lot permission denied");
}

public sealed record PublishRequest(int Version, bool ConfirmPublicContentReviewed);
public partial class Program;
