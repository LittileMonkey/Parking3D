using Microsoft.AspNetCore.Mvc;
using Parking.AI.Api.Swagger;
using Parking.AI.Application;
using Parking.AI.Application.DTOs.Assistant;
using Parking.AI.Application.DTOs.Common;
using Parking.AI.Application.DTOs.LicensePlate;
using Parking.AI.Application.DTOs.ParkingSearch;
using Parking.AI.Application.Interfaces;
using Parking.AI.Infrastructure;
using Parking.AI.Infrastructure.AiVision;
using Parking.AI.Infrastructure.GenAi;
using Parking.Contracts.Identity.V1;
using Parking.ServiceDefaults;

// =================================================================================================
// CHƯƠNG TRÌNH KHỞI TẠO VÀ CẤU HÌNH DỊCH VỤ PARKING.AI MICROSERVICE (.NET 9 & ASP.NET CORE MINIMAL APIS)
// =================================================================================================
// Các thư viện và mẫu kiến trúc được ứng dụng:
// 1. Minimal APIs: Cơ chế định tuyến hiệu năng cao của ASP.NET Core giúp giảm thiểu overhead và cấp phát bộ nhớ.
// 2. Typed HttpClients (AddHttpClient): Quản lý vòng đời HttpClient tập trung qua IHttpClientFactory, chống cạn kiệt socket.
// 3. gRPC Client & Server:
//    - MapGrpcService: Đón nhận RPC streaming/unary tốc độ cao từ Barrier/Camera cổng bãi xe.
//    - AddGrpcClient: Giao tiếp nội bộ tốc độ cao với dịch vụ Identity để kiểm tra phân quyền cơ sở (Facility RBAC).
// 4. Dual-Mode Input (License Plate Scanner): Linh hoạt chấp nhận cả File Upload (multipart/form-data) và chuỗi JSON Base64.
// =================================================================================================

var builder = WebApplication.CreateBuilder(args);

// Tự động nạp cấu hình từ file .env ở thư mục gốc khi chạy môi trường Development (dotnet run)
var searchDir = new DirectoryInfo(builder.Environment.ContentRootPath);
while (searchDir != null)
{
    var envPath = Path.Combine(searchDir.FullName, ".env");
    if (File.Exists(envPath))
    {
        foreach (var line in File.ReadAllLines(envPath))
        {
            var trimmed = line.Trim();
            if (string.IsNullOrWhiteSpace(trimmed) || trimmed.StartsWith('#')) continue;
            var parts = trimmed.Split('=', 2);
            if (parts.Length == 2)
            {
                var k = parts[0].Trim();
                var v = parts[1].Trim();
                if (!string.IsNullOrEmpty(v))
                {
                    if (k == "GEMINI_API_KEY")
                    {
                        builder.Configuration["Gemini:ApiKey"] = v;
                        builder.Configuration["AI:GeminiApiKey"] = v;
                    }
                    else if (k == "GEMINI_MODEL")
                    {
                        builder.Configuration["Gemini:Model"] = v;
                    }
                    else if (k == "OCR_ENDPOINT")
                    {
                        builder.Configuration["AI:OcrEndpoint"] = v;
                    }
                }
            }
        }
        break;
    }
    searchDir = searchDir.Parent;
}

// Cấu hình các thiết lập chuẩn của hệ sinh thái .NET Aspire / ServiceDefaults (OpenTelemetry, Logging, HealthChecks)
builder.AddParkingDefaults();

// Cấu hình Typed HttpClient với thời gian chờ (Timeout) được kiểm soát nghiêm ngặt tránh treo luồng:
builder.Services.AddHttpClient<IPlateProvider, HttpPlateProvider>(http => http.Timeout = TimeSpan.FromSeconds(10));
builder.Services.AddHttpClient<PythonFastApiClient>(http => http.Timeout = TimeSpan.FromSeconds(15));
builder.Services.AddHttpClient<GeminiApiClient>(http => http.Timeout = TimeSpan.FromSeconds(90));

// Đăng ký Dependency Injection (DI) theo đúng vòng đời dịch vụ:
// - Scoped: Tạo mới cho mỗi HTTP Request (phù hợp với các dịch vụ thao tác CSDL NpgsqlDataSource)
builder.Services.AddScoped<AIReadService>();
builder.Services.AddScoped<ILicensePlateRecognitionService, LicensePlateRecognitionService>();
builder.Services.AddScoped<IParkingSearchAiService, ParkingSearchAiService>();

// - Singleton: Tồn tại duy nhất trong suốt vòng đời ứng dụng (bắt buộc cho ParkingAssistantService vì lưu cache phiên hội thoại trong RAM)
builder.Services.AddSingleton<IParkingAssistantService, ParkingAssistantService>();

// Đăng ký gRPC Client kết nối tới Identity Service để kiểm tra quyền hạn nhân viên theo bãi xe (Facility RBAC)
builder.Services.AddGrpcClient<FacilityAuthorization.FacilityAuthorizationClient>(o =>
    o.Address = new Uri(builder.Configuration["Services:IdentityGrpc"] ?? "http://identity:8081"));

// Cấu hình Swagger OpenAPI Documentation
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new Microsoft.OpenApi.OpenApiInfo
    {
        Title = "Smart Parking AI Service API",
        Version = "v1",
        Description = "Microservice AI: Nhận diện biển số xe ANPR OCR, Trợ lý ảo AI và Tìm kiếm bãi xe thông minh"
    });

    // Tích hợp Schema Filter và Operation Filter chuẩn hóa mã phản hồi lỗi và thông điệp thực tế
    c.SchemaFilter<ApiResponseSchemaFilter>();
    c.OperationFilter<ApiResponseOperationFilter>();

    // Đọc chú thích XML Documentation từ API và Application layer
    var apiXml = Path.Combine(AppContext.BaseDirectory, $"{System.Reflection.Assembly.GetExecutingAssembly().GetName().Name}.xml");
    if (File.Exists(apiXml)) c.IncludeXmlComments(apiXml);

    var appXml = Path.Combine(AppContext.BaseDirectory, "Parking.AI.Application.xml");
    if (File.Exists(appXml)) c.IncludeXmlComments(appXml);
});

var app = builder.Build();

// Kích hoạt Swagger UI cho môi trường Development hoặc kiểm thử trực tiếp
app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "Smart Parking AI Service v1");
    c.RoutePrefix = "swagger";
});

// Điều hướng trang chủ '/' trực tiếp tới '/swagger' để người dùng thao tác tiện lợi
app.MapGet("/", () => Results.Redirect("/swagger"));

// Kích hoạt các middleware tiêu chuẩn (Exception Handler, HealthCheck Endpoint /health/ready, /health/live)
app.UseParkingDefaults("ai");

// Đăng ký các dịch vụ gRPC cho các thiết bị phần cứng tại cổng (Barrier, Camera ANPR, Cảm biến công suất)
app.MapGrpcService<PlateRecognitionGrpc>();
app.MapGrpcService<OccupancyIngestionGrpc>();

// -------------------------------------------------------------------------------------------------
// 1. NHÓM API DỰ BÁO CÔNG SUẤT VÀ TÀI LIỆU QUY CHẾ (OCCUPANCY FORECAST & FAQ)
// -------------------------------------------------------------------------------------------------

// Dự báo công suất sử dụng bãi xe theo khung thời gian (30/60/120 phút) dựa trên dữ liệu lịch sử
app.MapGet("/api/v1/parking-lots/{lotId:guid}/occupancy-forecasts", async (Guid lotId, string vehicleType, int horizonMinutes, AIReadService service, CancellationToken ct) =>
    Responses.Ok(await service.ForecastAsync(lotId, vehicleType, horizonMinutes, ct)))
    .WithSummary("Dự báo công suất sử dụng bãi xe theo khung thời gian (30/60/120 phút)")
    .WithTags("AI Occupancy Forecast")
    .Produces<ApiResponse<OccupancyForecastDto>>(StatusCodes.Status200OK)
    .Produces<ErrorResponse400>(StatusCodes.Status400BadRequest)
    .Produces<ErrorResponse500>(StatusCodes.Status500InternalServerError);

// Tra cứu FAQ / Quy định bãi xe theo từ khóa (Document Retrieval từ tài liệu đã duyệt, không dùng LLM)
app.MapPost("/api/v1/parking-lots/{lotId:guid}/assistant", async (Guid lotId, AssistantRequest request, AIReadService service, CancellationToken ct) =>
    Responses.Ok(await service.AssistantAsync(lotId, request.Question, ct)))
    .WithSummary("Tra cứu FAQ / Quy định bãi xe theo từ khóa (Document Retrieval từ tài liệu đã duyệt, không dùng LLM)")
    .WithTags("AI Assistant FAQ (No-LLM)")
    .Produces<ApiResponse<AssistantFaqDto>>(StatusCodes.Status200OK)
    .Produces<ErrorResponse400>(StatusCodes.Status400BadRequest)
    .Produces<ErrorResponse404>(StatusCodes.Status404NotFound)
    .Produces<ErrorResponse500>(StatusCodes.Status500InternalServerError);

// -------------------------------------------------------------------------------------------------
// 2. NHÓM API QUẢN LÝ TÀI LIỆU TRI THỨC VÀ SOÁT XÉT BIỂN SỐ THỦ CÔNG
// -------------------------------------------------------------------------------------------------

// Tạo tài liệu tri thức mới cho trợ lý AI (Chế độ DRAFT, yêu cầu quyền ADMIN)
app.MapPost("/api/v1/ai/documents", async (DocumentRequest request, HttpContext context, FacilityAuthorization.FacilityAuthorizationClient identity, AIReadService service, CancellationToken ct) =>
{
    await Require(context.User.Subject(), Guid.Empty, "ADMIN", identity, ct);
    return Responses.Ok(new { id = await service.CreateDocumentAsync(context.User.Subject(), request, ct) });
}).RequireAuthorization()
.WithSummary("Tạo tài liệu tri thức mới cho trợ lý AI (Chế độ DRAFT, yêu cầu quyền ADMIN)")
.WithTags("AI Knowledge Management")
.Produces<ApiResponse<EntityIdResultDto>>(StatusCodes.Status200OK)
.Produces<ErrorResponse400>(StatusCodes.Status400BadRequest)
.Produces<ErrorResponse401>(StatusCodes.Status401Unauthorized)
.Produces<ErrorResponse403>(StatusCodes.Status403Forbidden)
.Produces<ErrorResponse500>(StatusCodes.Status500InternalServerError);

// Duyệt và xuất bản tài liệu tri thức AI sang trạng thái PUBLISHED
app.MapPost("/api/v1/ai/documents/{id:guid}/publish", async (Guid id, PublishRequest request, HttpContext context, FacilityAuthorization.FacilityAuthorizationClient identity, AIReadService service, CancellationToken ct) =>
{
    await Require(context.User.Subject(), Guid.Empty, "ADMIN", identity, ct);
    if (!request.ConfirmPublicContentReviewed) throw new ServiceException(400, "Explicit public-content review confirmation required");
    await service.PublishAsync(context.User.Subject(), id, request.Version, ct);
    return Responses.Ok(new { id, status = "PUBLISHED" });
}).RequireAuthorization()
.WithSummary("Duyệt và xuất bản tài liệu tri thức AI sang trạng thái PUBLISHED")
.WithTags("AI Knowledge Management")
.Produces<ApiResponse<EntityStatusResultDto>>(StatusCodes.Status200OK)
.Produces<ErrorResponse400>(StatusCodes.Status400BadRequest)
.Produces<ErrorResponse401>(StatusCodes.Status401Unauthorized)
.Produces<ErrorResponse403>(StatusCodes.Status403Forbidden)
.Produces<ErrorResponse404>(StatusCodes.Status404NotFound)
.Produces<ErrorResponse409>(StatusCodes.Status409Conflict)
.Produces<ErrorResponse500>(StatusCodes.Status500InternalServerError);

// Soát xét và cập nhật biển số xe OCR thủ công từ nhân viên bãi xe (Staff Review)
app.MapPost("/api/v1/parking-lots/{lotId:guid}/plate-recognitions/{id:guid}/review", async (Guid lotId, Guid id, PlateReviewRequest request, HttpContext context, FacilityAuthorization.FacilityAuthorizationClient identity, AIReadService service, CancellationToken ct) =>
{
    await Require(context.User.Subject(), lotId, "OCR", identity, ct);
    await service.ReviewAsync(context.User.Subject(), lotId, id, request, ct);
    return Responses.Ok(new { id, status = "REVIEWED" });
}).RequireAuthorization()
.WithSummary("Soát xét và cập nhật biển số xe OCR thủ công từ nhân viên bãi xe")
.WithTags("AI Vision ANPR OCR")
.Produces<ApiResponse<EntityStatusResultDto>>(StatusCodes.Status200OK)
.Produces<ErrorResponse400>(StatusCodes.Status400BadRequest)
.Produces<ErrorResponse401>(StatusCodes.Status401Unauthorized)
.Produces<ErrorResponse403>(StatusCodes.Status403Forbidden)
.Produces<ErrorResponse404>(StatusCodes.Status404NotFound)
.Produces<ErrorResponse409>(StatusCodes.Status409Conflict)
.Produces<ErrorResponse500>(StatusCodes.Status500InternalServerError);

// -------------------------------------------------------------------------------------------------
// 3. NHÓM TÍNH NĂNG MỞ RỘNG: THỊ GIÁC MÁY TÍNH NHẬN DIỆN BIỂN SỐ XE (ANPR OCR)
// -------------------------------------------------------------------------------------------------

// Endpoint hỗ trợ cả 2 phương thức tải ảnh:
// 1. Tải file nhị phân qua Form-Data (Thường dùng cho Web Admin, Mobile App hoặc Postman)
// 2. Gửi chuỗi Base64 qua JSON Body (Thường dùng cho thiết bị Edge IoT / Camera Barrier)
app.MapPost("/api/v1/ai/license-plate/scan", async (HttpRequest httpRequest, HttpContext httpContext, ILicensePlateRecognitionService service, CancellationToken ct) =>
{
    // Trích xuất mã định danh người dùng nếu có phiên đăng nhập
    Guid? uploadedBy = Guid.TryParse(httpContext.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? httpContext.User.FindFirst("sub")?.Value, out var uid) ? uid : null;

    // Trường hợp 1: Dữ liệu tải lên dạng multipart/form-data
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

        // Kiểm tra dung lượng ảnh tối đa (ImageRules.MaxImageBytes = 10MB)
        if (file.Length > Parking.AI.Domain.ImageRules.MaxImageBytes)
            return Responses.Error(400, $"Kích thước ảnh vượt quá giới hạn cho phép ({Parking.AI.Domain.ImageRules.MaxImageBytes / 1024 / 1024}MB).");

        using var ms = new MemoryStream();
        await file.CopyToAsync(ms, ct);
        var bytes = ms.ToArray();

        // Kiểm tra chữ ký Magic Bytes của ảnh chống giả mạo đuôi file (.exe, .sh đổi tên thành .jpg: DEF-08)
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

    // Trường hợp 2: Dữ liệu gửi lên dạng JSON Body chứa chuỗi Base64
    var request = await httpRequest.ReadFromJsonAsync<PlateRecognitionRequestDto>(cancellationToken: ct);
    if (request == null || string.IsNullOrWhiteSpace(request.ImageBase64))
        return Responses.Error(400, "Yêu cầu chuỗi Base64 imageBase64 hoặc form-data file.");

    if (request.UploadedBy == null && uploadedBy != null)
        request = request with { UploadedBy = uploadedBy };

    var jsonResult = await service.RecognizePlateAsync(request, ct);
    return Responses.Ok(jsonResult, "Nhận diện biển số xe thành công.");
})
.WithSummary("Quét và nhận diện biển số xe (ANPR OCR) qua File Upload hoặc Base64 JSON")
.WithTags("AI Vision ANPR OCR")
.Produces<ApiResponse<PlateRecognitionResultDto>>(StatusCodes.Status200OK)
.Produces<ErrorResponse400>(StatusCodes.Status400BadRequest)
.Produces<ErrorResponse500>(StatusCodes.Status500InternalServerError);

// -------------------------------------------------------------------------------------------------
// 4. NHÓM TÍNH NĂNG MỞ RỘNG: TRỢ LÝ ẢO ĐÀM THOẠI AI CHATBOT (CONVERSATIONAL ASSISTANT)
// -------------------------------------------------------------------------------------------------

// Trò chuyện cùng Trợ lý ảo AI đàm thoại đa lượt (Có tích hợp LLM Gemini + Domain Guardrails)
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
.WithTags("AI Conversational Assistant")
.Produces<ApiResponse<AssistantChatResponseDto>>(StatusCodes.Status200OK)
.Produces<ErrorResponse400>(StatusCodes.Status400BadRequest)
.Produces<ErrorResponse500>(StatusCodes.Status500InternalServerError);

// Xóa hoặc làm mới phiên hội thoại
app.MapDelete("/api/v1/ai/assistant/session/{sessionId:guid}", async (Guid sessionId, IParkingAssistantService service, CancellationToken ct) =>
{
    var ok = await service.ResetSessionAsync(sessionId, ct);
    return Responses.Ok(ok, ok ? "Đã làm mới phiên hội thoại thành công." : "Phiên hội thoại không tồn tại.");
})
.WithSummary("Làm mới hoặc xóa phiên hội thoại của trợ lý AI")
.WithTags("AI Conversational Assistant")
.Produces<ApiResponse<bool>>(StatusCodes.Status200OK)
.Produces<ErrorResponse404>(StatusCodes.Status404NotFound)
.Produces<ErrorResponse500>(StatusCodes.Status500InternalServerError);

// -------------------------------------------------------------------------------------------------
// 5. NHÓM TÍNH NĂNG MỞ RỘNG: TÌM KIẾM BÃI XE THÔNG MINH (SMART SEARCH & RECOMMENDATION)
// -------------------------------------------------------------------------------------------------

// Tìm kiếm bãi đỗ xe thông minh bằng câu lệnh ngôn ngữ tự nhiên (Natural Language Search)
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
.WithTags("AI Smart Parking Search")
.Produces<ApiResponse<ParkingRecommendationDto>>(StatusCodes.Status200OK)
.Produces<ErrorResponse400>(StatusCodes.Status400BadRequest)
.Produces<ErrorResponse500>(StatusCodes.Status500InternalServerError);

// Gợi ý danh sách bãi xe tối ưu dựa trên tiêu chí khoảng cách, giá vé (Rule 7) và công suất
app.MapPost("/api/v1/ai/parking/recommend", async (SmartSearchCriteriaDto criteria, IParkingSearchAiService service, CancellationToken ct) =>
{
    var result = await service.RecommendParkingAsync(criteria, ct);
    return Responses.Ok(result, "Gợi ý bãi xe thành công.");
})
.WithSummary("Gợi ý danh sách bãi xe tối ưu dựa trên tiêu chí khoảng cách, giá vé (Rule 7) và công suất")
.WithTags("AI Smart Parking Search")
.Produces<ApiResponse<ParkingRecommendationDto>>(StatusCodes.Status200OK)
.Produces<ErrorResponse400>(StatusCodes.Status400BadRequest)
.Produces<ErrorResponse500>(StatusCodes.Status500InternalServerError);

// Khởi chạy Web Application bất đồng bộ
await app.RunAsync();

// -------------------------------------------------------------------------------------------------
// HÀM TIỆN ÍCH KIỂM TRA PHÂN QUYỀN CƠ SỞ (FACILITY-SCOPED AUTHORIZATION HELPER)
// -------------------------------------------------------------------------------------------------
async Task Require(Guid user, Guid lot, string capability, FacilityAuthorization.FacilityAuthorizationClient identity, CancellationToken ct)
{
    var reply = await identity.CheckAccessAsync(new AccessRequest { UserId = user.ToString(), LotId = lot.ToString(), Capability = capability }, headers: GrpcHeaders.For(builder.Configuration), deadline: DateTime.UtcNow.AddSeconds(3), cancellationToken: ct);
    if (!reply.Allowed) throw new ServiceException(403, "Current account/lot permission denied");
}

public sealed record PublishRequest(int Version, bool ConfirmPublicContentReviewed);
public partial class Program;
