using System.Text.Json.Serialization;
using ParkingSystem.Application.Common.Interfaces;
using ParkingSystem.Infrastructure.ExternalServices.AiVision;
using ParkingSystem.Infrastructure.ExternalServices.GenAi;

var builder = WebApplication.CreateBuilder(args);

// Cấu hình Controllers và JSON Serilaization
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
        options.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
    });

builder.Services.AddOpenApi();

// Đăng ký HttpClients & Services ngoại vi
builder.Services.AddHttpClient<PythonFastApiClient>(client =>
{
    var url = builder.Configuration["AiVision:ServiceUrl"] ?? "http://localhost:8000";
    client.BaseAddress = new Uri(url);
    client.Timeout = TimeSpan.FromSeconds(10);
});

builder.Services.AddHttpClient<GeminiApiClient>(client =>
{
    client.Timeout = TimeSpan.FromSeconds(30);
});

// Đăng ký Dependency Injection theo chuẩn Clean Architecture (.NET 10)
builder.Services.AddScoped<ILicensePlateRecognitionService, LicensePlateRecognitionService>();
builder.Services.AddScoped<IParkingSearchAiService, ParkingSearchAiService>();
builder.Services.AddScoped<IParkingAssistantService, ParkingAssistantService>();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();
app.UseAuthorization();

app.MapGet("/", () => Results.Ok(new
{
    service = "Parking AI Clean Architecture Web API",
    framework = ".NET 10",
    modules = new[] { "License Plate OCR", "Smart Search NLP", "AI Assistant" },
    status = "healthy"
}));

app.MapControllers();

app.Run();
