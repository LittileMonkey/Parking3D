using Microsoft.EntityFrameworkCore;
using ParkingSystem.Data;
using Npgsql;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddOpenApi();

// Đọc cấu hình đã lưu trong User Secrets.
var connectionString =
    builder.Configuration.GetConnectionString("Parking")
    ?? throw new InvalidOperationException(
        "Chưa cấu hình ConnectionStrings:Parking.");

// Dùng chung DataSource để quản lý kết nối PostgreSQL.
builder.Services.AddSingleton<NpgsqlDataSource>(_ =>
    NpgsqlDataSource.Create(connectionString));

builder.Services.AddDbContext<ParkingDbContext>(options => options.UseNpgsql(connectionString));

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();

    app.MapGet("/health/ready", async (ParkingDbContext db, CancellationToken ct) =>
    {
        try
        {
            await db.ParkingLots.AsNoTracking().Select(x => x.Id).Take(1).ToListAsync(ct);
            return Results.Ok(new { status = "ready", database = "PostgreSQL" });
        }
        catch (NpgsqlException ex)
        {
            app.Logger.LogError(ex, "Database schema is not ready.");
            return Results.Problem(title: "Database schema is not ready.", statusCode: 503);
        }
    });

    // API kiểm tra chỉ mở trong môi trường Development.
    app.MapGet("/api/database/test", async (
        NpgsqlDataSource dataSource,
        CancellationToken cancellationToken) =>
    {
        try
        {
            await using var command = dataSource.CreateCommand(
                "SELECT current_database();");

            var databaseName =
                await command.ExecuteScalarAsync(cancellationToken);

            return Results.Ok(new
            {
                connected = true,
                database = databaseName?.ToString(),
                message = "Kết nối PostgreSQL thành công."
            });
        }
        catch (NpgsqlException ex)
        {
            app.Logger.LogError(
                ex, "Không thể kết nối PostgreSQL.");

            return Results.Problem(
                title: "Không thể kết nối PostgreSQL.",
                detail: "Kiểm tra thông báo lỗi trong Terminal.",
                statusCode: StatusCodes.Status503ServiceUnavailable);
        }
    });
}

app.UseHttpsRedirection();
app.UseAuthorization();
app.MapControllers();

app.Run();
