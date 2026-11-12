using Microsoft.AspNetCore.Mvc;
using Npgsql;
using Parking.Contracts.AI.V1;
using Parking.Contracts.Identity.V1;
using Parking.Contracts.Checkout.V1;
using Parking.Parking.Api.Realtime;
using Parking.Parking.Application;
using Parking.Parking.Application.Interfaces;
using Parking.Parking.Infrastructure;
using Parking.Parking.Persistence;
using Parking.Parking.Api.Middleware;
using Parking.Parking.Infrastructure.BackgroundServices;
using Parking.Parking.Infrastructure.Repositories;
using Parking.Parking.Infrastructure.Services;
using Parking.Parking.Infrastructure.Cache;
using Parking.ServiceDefaults;
using Parking.Parking.Api;


var builder = WebApplication.CreateBuilder(args);
builder.AddParkingDefaults();
builder.Services.AddGrpcClient<FacilityAuthorization.FacilityAuthorizationClient>(o => o.Address = new Uri(builder.Configuration["Services:IdentityGrpc"] ?? "http://identity:8081"));
builder.Services.AddGrpcClient<PlateRecognition.PlateRecognitionClient>(o => o.Address = new Uri(builder.Configuration["Services:AIGrpc"] ?? "http://ai:8081"));
builder.Services.AddGrpcClient<OccupancyIngestion.OccupancyIngestionClient>(o => o.Address = new Uri(builder.Configuration["Services:AIGrpc"] ?? "http://ai:8081"));
builder.Services.AddScoped<IFacilityAccess, FacilityAccess>();
builder.Services.AddGrpcClient<CheckoutSettlement.CheckoutSettlementClient>(o=>o.Address=new Uri(
    builder.Configuration["Services:PaymentGrpc"]??(builder.Environment.IsDevelopment()?"http://127.0.0.1:8085":"http://payment:8081")));
builder.Services.AddScoped<ICheckOutPayments,CheckOutPayments>();
builder.Services.AddSingleton<ICheckOutTokens,CheckOutTokens>();
builder.Services.AddSignalR();
builder.Services.AddHostedService<ParkingEventWorker>();
builder.Services.AddScoped<IRecognitionClient, RecognitionClient>();
builder.Services.AddParkingPersistence();
builder.Services.AddScoped<OperationsRepository>();
builder.Services.AddScoped<BookingCancellationRepository>();
builder.Services.AddScoped<SlotReallocationRepository>();
builder.Services.AddScoped<RegisteredVehicleSync>();
builder.Services.AddHostedService<OccupancyWorker>();
builder.Services.AddHostedService<HoldExpiryWorker>();
builder.Services.AddHostedService<NotificationReminderWorker>();
builder.Services.AddMemoryCache();
builder.Services.AddParkingCaching(builder.Configuration);
// 2. ÄÄƒng kÃ½ Repository vÃ  Service tÃ­nh giÃ¡ THáº¬T (thay tháº¿ Fake)
builder.Services.AddScoped<IParkingLotRepository, ParkingLotRepository>();
builder.Services.AddScoped<IEstimatedPriceService, EstimatedPriceService>();

builder.Services.AddControllers().ConfigureApiBehaviorOptions(options =>
    options.InvalidModelStateResponseFactory = context => new BadRequestObjectResult(
        new Parking.ServiceDefaults.ApiResponse<object>(null, false, 400, "Invalid request parameters.")));

builder.Services.AddSingleton<IQrTokenService, QrTokenService>();
builder.Services.AddApplicationServices();
var app = builder.Build();
app.UseParkingDefaults("parking");
app.UseMiddleware<ExceptionHandlingMiddleware>();
app.MapLotOperations();
app.MapNotifications();
app.MapGrpcService<ParkingCatalogGrpc>();
app.MapGrpcService<BookingPaymentQueryGrpc>();
app.MapGrpcService<PaymentEventsGrpc>();
app.MapGrpcService<ParkingCheckoutQueryGrpc>();
app.MapGrpcService<ParkingCheckoutEventsGrpc>();
app.MapHub<ParkingHub>("/hubs/parking");

app.MapGet("/api/v1/parking-lots", async (IParkingRepository repo, CancellationToken ct) =>
    Responses.Ok(await repo.ListLotsAsync(ct)));

app.MapGet("/api/v1/parking-lots/{lotId:guid}/entry-gates", async (
    Guid lotId, HttpContext context, IFacilityAccess access, NpgsqlDataSource db, CancellationToken ct) =>
{
    await access.RequireAsync(context.User.Subject(), lotId, "CHECK_IN", ct);
    await using var command = db.CreateCommand("""
        SELECT id, code FROM lot_gates WHERE lot_id = @lot AND gate_kind IN ('ENTRY', 'BOTH') ORDER BY code
        """);
    command.Parameters.AddWithValue("lot", lotId);
    await using var reader = await command.ExecuteReaderAsync(ct);
    var gates = new List<EntryGate>();
    while (await reader.ReadAsync(ct))
        gates.Add(new EntryGate(reader.GetGuid(0), lotId, reader.GetString(1)));
    return Responses.Ok(gates);
}).RequireAuthorization();

app.MapGet("/api/v1/parking-lots/{lotId:guid}/exit-gates", async (
    Guid lotId, HttpContext context, IFacilityAccess access, NpgsqlDataSource db, CancellationToken ct) =>
{
    await access.RequireAsync(context.User.Subject(), lotId, "GATE", ct);
    await using var command = db.CreateCommand("""
        SELECT id, code FROM lot_gates WHERE lot_id = @lot AND gate_kind IN ('EXIT', 'BOTH') ORDER BY code
        """);
    command.Parameters.AddWithValue("lot", lotId);
    await using var reader = await command.ExecuteReaderAsync(ct);
    var gates = new List<EntryGate>();
    while (await reader.ReadAsync(ct))
        gates.Add(new EntryGate(reader.GetGuid(0), lotId, reader.GetString(1)));
    return Responses.Ok(gates);
}).RequireAuthorization();

app.MapGet("/api/v1/parking-lots/{lotId:guid}/sessions", async (
    Guid lotId, HttpContext context, IFacilityAccess access, NpgsqlDataSource db, CancellationToken ct) =>
{
    await access.RequireAsync(context.User.Subject(), lotId, "GATE", ct);
    await using var command = db.CreateCommand("""
        SELECT ps.id, ps.plate_snapshot, ps.vehicle_type, ps.entry_at, ps.exit_at,
               ps.status::text, s.code, l.name
        FROM parking_sessions ps
        JOIN LATERAL (
            SELECT slot_id FROM session_slot_assignments
            WHERE session_id = ps.id AND lot_id = ps.lot_id
            ORDER BY occupied_from DESC LIMIT 1
        ) a ON true
        JOIN parking_slots s ON s.id = a.slot_id AND s.lot_id = ps.lot_id
        JOIN parking_levels l ON l.id = s.level_id AND l.lot_id = s.lot_id
        WHERE ps.lot_id = @lot
        ORDER BY (ps.status = 'COMPLETED'), ps.entry_at DESC
        LIMIT 100
        """);
    command.Parameters.AddWithValue("lot", lotId);
    await using var reader = await command.ExecuteReaderAsync(ct);
    var sessions = new List<StaffSession>();
    while (await reader.ReadAsync(ct))
        sessions.Add(new StaffSession(reader.GetGuid(0), lotId, reader.GetString(1), reader.GetString(2),
            reader.GetFieldValue<DateTimeOffset>(3), reader.IsDBNull(4) ? null : reader.GetFieldValue<DateTimeOffset>(4),
            reader.GetString(5), reader.GetString(6), reader.GetString(7)));
    return Responses.Ok(sessions);
}).RequireAuthorization();

app.MapPost("/api/v1/bookings", async (BookingRequest request, HttpContext context, IFacilityAccess access, IParkingRepository repo, RegisteredVehicleSync vehicles, CancellationToken ct) =>
{
    await access.RequireAsync(context.User.Subject(), Guid.Empty, "USER", ct);
    await vehicles.EnsureAsync(context.User.Subject(), request.VehicleId, ct);
    return Responses.Ok(await repo.CreateBookingAsync(context.User.Subject(), request, context.Request.Headers["Idempotency-Key"].ToString(), ct));
}).RequireAuthorization();

app.MapPost("/api/v1/parking-lots/{lotId:guid}/plate-recognitions", async (Guid lotId, RecognitionUpload request, HttpContext context, IFacilityAccess access, IParkingRepository repo, IRecognitionClient client, CancellationToken ct) =>
{
    var actor = context.User.Subject();
    await access.RequireAsync(actor, lotId, "OCR", ct);
    if (!await repo.LotExistsAsync(lotId, ct)) return Responses.Error(404, "Lot not found");
    return Responses.Ok(await client.RecognizeAsync(actor, lotId, context.Request.Headers["Idempotency-Key"].ToString(), request, ct));
}).RequireAuthorization();
app.MapPost("/api/v1/bookings/{id:guid}/cancel", async (Guid id, CancelBookingRequest request, HttpContext ctx, IFacilityAccess access, BookingCancellationRepository repo, CancellationToken ct) => {
    await access.RequireAsync(ctx.User.Subject(),Guid.Empty,"USER",ct);
    return Responses.Ok(await repo.CancelAsync(id,ctx.User.Subject(),request,ct));
}).RequireAuthorization();
app.MapGet("/api/v1/bookings/{id:guid}/cancellation", async (Guid id, HttpContext ctx, IFacilityAccess access, BookingCancellationRepository repo, CancellationToken ct) => {
    await access.RequireAsync(ctx.User.Subject(),Guid.Empty,"USER",ct);
    return Responses.Ok(await repo.ReadAsync(id,ctx.User.Subject(),ct));
}).RequireAuthorization();
app.MapControllers();
app.MapGet("/api/v1/bookings/mine",async(HttpContext ctx,IFacilityAccess access,NpgsqlDataSource db,CancellationToken ct)=>{
    var actor=ctx.User.Subject();await access.RequireAsync(actor,Guid.Empty,"USER",ct);
    await using var command=db.CreateCommand("""
        SELECT coalesce(jsonb_agg(row_to_json(x)),'[]'::jsonb)::text FROM (
        SELECT b.id,b.code,b.status::text,b.starts_at AS "startsAt",b.ends_at AS "endsAt",b.estimated_amount AS "estimatedAmount",l.name AS "lotName"
        FROM bookings b JOIN parking_lots l ON l.id=b.lot_id WHERE b.customer_id=@actor ORDER BY b.created_at DESC LIMIT 100)x
        """);
    command.Parameters.AddWithValue("actor",actor);
    return Responses.Ok(System.Text.Json.JsonSerializer.Deserialize<System.Text.Json.JsonElement>((string)(await command.ExecuteScalarAsync(ct))!));
}).RequireAuthorization();

await app.RunAsync();

public partial class Program;

internal sealed record EntryGate(Guid Id, Guid LotId, string Code);

internal sealed record StaffSession(Guid SessionId, Guid LotId, string LicensePlate, string VehicleType,
    DateTimeOffset CheckinAt, DateTimeOffset? CheckoutAt, string Status, string SlotCode, string LevelName);
