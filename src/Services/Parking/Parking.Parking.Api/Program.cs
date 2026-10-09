using Microsoft.AspNetCore.Mvc;
using Parking.Contracts.AI.V1;
using Parking.Contracts.Identity.V1;
using Parking.Parking.Application;
using Parking.Parking.Infrastructure;
using Parking.ServiceDefaults;

var builder = WebApplication.CreateBuilder(args);
builder.AddParkingDefaults();
builder.Services.AddGrpcClient<FacilityAuthorization.FacilityAuthorizationClient>(o => o.Address = new Uri(builder.Configuration["Services:IdentityGrpc"] ?? "http://identity:8081"));
builder.Services.AddGrpcClient<PlateRecognition.PlateRecognitionClient>(o => o.Address = new Uri(builder.Configuration["Services:AIGrpc"] ?? "http://ai:8081"));
builder.Services.AddGrpcClient<OccupancyIngestion.OccupancyIngestionClient>(o => o.Address = new Uri(builder.Configuration["Services:AIGrpc"] ?? "http://ai:8081"));
builder.Services.AddScoped<IFacilityAccess, FacilityAccess>();
builder.Services.AddScoped<IRecognitionClient, RecognitionClient>();
builder.Services.AddScoped<IParkingRepository, ParkingRepository>();
builder.Services.AddHostedService<OccupancyWorker>();
builder.Services.AddHostedService<HoldExpiryWorker>();

var app = builder.Build();
app.UseParkingDefaults("parking");
app.MapGrpcService<ParkingCatalogGrpc>();
app.MapGrpcService<BookingPaymentQueryGrpc>();
app.MapGrpcService<PaymentEventsGrpc>();

app.MapGet("/api/v1/parking-lots", async (IParkingRepository repo, CancellationToken ct) => 
    Responses.Ok(await repo.ListLotsAsync(ct)));

// SCRUM-48: S2-04 Availability Lookup API
app.MapGet("/api/v1/parking-lots/{lotId:guid}/availability", async (
    Guid lotId,
    [FromQuery] DateTimeOffset? startTime,
    [FromQuery] DateTimeOffset? endTime,
    [FromQuery] string? vehicleType,
    [FromQuery] Guid? levelId,
    IParkingRepository repo,
    CancellationToken ct) =>
{
    var view = await repo.GetLotAvailabilityAsync(lotId, startTime, endTime, vehicleType, levelId, ct);
    return Responses.Ok(view);
});

// SCRUM-48: S2-04 Booking Detail Lookup API (Facility-Scoped & Resource Ownership Protected)
app.MapGet("/api/v1/bookings/{bookingId:guid}", async (
    Guid bookingId,
    HttpContext context,
    IParkingRepository repo,
    CancellationToken ct) =>
{
    var userId = context.User.Subject();
    var detail = await repo.GetBookingDetailAsync(bookingId, userId, ct);
    return Responses.Ok(detail);
}).RequireAuthorization();

app.MapPost("/api/v1/bookings", async (BookingRequest request, HttpContext context, IFacilityAccess access, IParkingRepository repo, CancellationToken ct) =>
{
    await access.RequireAsync(context.User.Subject(), Guid.Empty, "USER", ct);
    return Responses.Ok(await repo.CreateBookingAsync(context.User.Subject(), request, context.Request.Headers["Idempotency-Key"].ToString(), ct));
}).RequireAuthorization();

app.MapPost("/api/v1/parking-lots/{lotId:guid}/plate-recognitions", async (Guid lotId, RecognitionUpload request, HttpContext context, IFacilityAccess access, IParkingRepository repo, IRecognitionClient client, CancellationToken ct) =>
{
    var actor = context.User.Subject();
    await access.RequireAsync(actor, lotId, "OCR", ct);
    if (!await repo.LotExistsAsync(lotId, ct)) return Responses.Error(404, "Lot not found");
    return Responses.Ok(await client.RecognizeAsync(actor, lotId, context.Request.Headers["Idempotency-Key"].ToString(), request, ct));
}).RequireAuthorization();

await app.RunAsync();

public partial class Program;
