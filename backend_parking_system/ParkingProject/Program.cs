using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using ParkingProject.Data;
using ParkingProject.Services;

var builder = WebApplication.CreateBuilder(args);
// Console logging also works without Windows Event Log write permissions.
builder.Logging.ClearProviders();
builder.Logging.AddConsole();
builder.Logging.AddDebug();
builder.Services.AddControllers().AddJsonOptions(options =>
    options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter(allowIntegerValues: false)));
builder.Services.AddOpenApi();
builder.Services.AddProblemDetails();
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddDbContext<ParkingDbContext>(options => options.UseNpgsql(
    builder.Configuration.GetConnectionString("Parking") ??
    "Host=localhost;Port=5432;Database=parking_ojt;Username=parking_app;Timeout=3"));
builder.Services.AddScoped<BookingService>();
if (builder.Configuration.GetValue<bool>("Features:GuestBookings"))
    builder.Services.AddHostedService<HoldExpiryWorker>();
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = 429;
    options.AddPolicy("guest-bookings", context => RateLimitPartition.GetFixedWindowLimiter(
        context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 20, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
});
var app = builder.Build();

// Export schema does not connect to or modify the database.
if (args.Contains("--export-schema"))
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<ParkingDbContext>();
    Directory.CreateDirectory("Database");
    await File.WriteAllTextAsync("Database/001_initial.sql", db.Database.GenerateCreateScript());
    return;
}
if (args.Contains("--seed-demo"))
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<ParkingDbContext>();
    await using var tx = await db.Database.BeginTransactionAsync();
    await db.Database.ExecuteSqlRawAsync("SELECT pg_advisory_xact_lock(26092301)");
    if (await db.Slots.AnyAsync()) throw new InvalidOperationException("Database already has slots; refusing to overwrite.");
    db.Slots.AddRange(DemoParking.CreateSlots());
    await db.SaveChangesAsync();
    await tx.CommitAsync();
    Console.WriteLine("Created 2000 NORMAL demo slots. Configure actual layout separately.");
    return;
}
app.UseExceptionHandler();
app.Use(async (context, next) =>
{
    try { await next(context); }
    catch (BookingRuleException ex)
    { await Results.Problem(statusCode: 409, title: "Booking conflict", detail: ex.Message).ExecuteAsync(context); }
    catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: "23505" })
    { await Results.Problem(statusCode: 409, title: "Vehicle or slot already booked.").ExecuteAsync(context); }
    catch (DbUpdateConcurrencyException)
    { await Results.Problem(statusCode: 409, title: "Data changed. Please retry.").ExecuteAsync(context); }
    catch (NpgsqlException ex)
    {
        app.Logger.LogError(ex, "PostgreSQL unavailable");
        await Results.Problem(statusCode: 503, title: "Database unavailable. Check PostgreSQL connection and schema.").ExecuteAsync(context);
    }
});
if (app.Environment.IsDevelopment()) app.MapOpenApi();
else app.UseHttpsRedirection();
app.UseRateLimiter();
app.UseAuthorization();
app.MapGet("/", () => Results.Ok(new { name = "Parking OJT API", stage = "Foundation - Guest booking", docs = "/openapi/v1.json" }));
app.MapGet("/health/live", () => Results.Ok(new { status = "up" }));
app.MapGet("/health/ready", async (ParkingDbContext db, CancellationToken ct) =>
{
    try
    {
        await db.Slots.AsNoTracking().OrderBy(x => x.Id).Select(x => x.Id).Take(1).ToListAsync(ct);
        return Results.Ok(new { status = "ready" });
    }
    catch (Exception ex) when (ex is NpgsqlException or InvalidOperationException)
    { return Results.Problem(statusCode: 503, title: "PostgreSQL/schema not ready."); }
});
app.MapControllers();
app.Run();
