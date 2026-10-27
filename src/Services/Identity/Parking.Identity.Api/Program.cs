using Identity.Infrastructure;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.Server.Kestrel.Core;
using Parking.Identity.Api.Middleware;
using Parking.Identity.Application;
using Parking.Identity.Application.Common.Enum;
using Parking.Identity.Infrastructure;
using Parking.Identity.Infrastructure.Initializer;
using Parking.Identity.Persistence;
using Parking.Identity.Persistence.DataAccessLayer;
using Parking.ServiceDefaults;
using System.Net;
using System.Text.Json;
using System.Threading.RateLimiting;
using IdentityApiResponse = Parking.Identity.Application.DTOs.Response.ApiResponse<object>;

namespace Parking.Identity.Api
{
    public class Program
    {
        public static async Task Main(string[] args)
        {
            var builder = WebApplication.CreateBuilder(args);

            // Configure Kestrel only outside Development.
            // Development uses launchSettings.json.
            if (!builder.Environment.IsDevelopment())
            {
                builder.WebHost.ConfigureKestrel(k =>
                {
                    var bind = builder.Configuration["Ports:Bind"] == "0.0.0.0"
                        ? IPAddress.Any
                        : IPAddress.Loopback;

                    k.Listen(
                        bind,
                        builder.Configuration.GetValue<int>("Ports:Http", 8080),
                        o => o.Protocols = HttpProtocols.Http1);

                    k.Listen(
                        bind,
                        builder.Configuration.GetValue<int>("Ports:Grpc", 8081),
                        o => o.Protocols = HttpProtocols.Http2);
                });
            }
            // Rate Limiting
            builder.Services.AddRateLimiter(options =>
            {
                options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
                options.OnRejected = async (context, cancellationToken) =>
                {
                    context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
                    context.HttpContext.Response.ContentType = "application/json";

                    var response = IdentityApiResponse.Failure(
                        "Too many requests. Please try again later.",
                        statusCode: StatusCodes.Status429TooManyRequests,
                        errorCode: ErrorCode.RateLimitExceeded);

                    await context.HttpContext.Response.WriteAsJsonAsync(response, cancellationToken: cancellationToken);
                };

                // Auth endpoints policy: 10 requests / 1 minute per IP
                options.AddPolicy("auth-rate-limit", httpContext =>
                {
                    var clientId = httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
                    return RateLimitPartition.GetFixedWindowLimiter(
                        partitionKey: clientId,
                        factory: _ => new FixedWindowRateLimiterOptions
                        {
                            PermitLimit = 10,
                            Window = TimeSpan.FromMinutes(1),
                            QueueLimit = 0
                        });
                });

                // General endpoints policy: 100 requests / 1 minute per IP
                options.AddPolicy("general-rate-limit", httpContext =>
                {
                    var clientId = httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
                    return RateLimitPartition.GetFixedWindowLimiter(
                        partitionKey: clientId,
                        factory: _ => new FixedWindowRateLimiterOptions
                        {
                            PermitLimit = 120,
                            Window = TimeSpan.FromMinutes(1),
                            QueueLimit = 0
                        });
                });
            });

            // Add services to the container.
            builder.Services.AddControllers();
            builder.Services.AddOpenApi();

            // Dependency Injection
            builder.Services.AddPersistenceDependencyInjection(
                builder.Configuration);

            builder.Services.AddInfrastructureDependencyInjection(
                builder.Configuration);

            builder.Services.AddApplicationDependencyInjection(
                builder.Configuration);

            // gRPC
            builder.Services.AddGrpc(o =>
            {
                o.Interceptors.Add<ServiceKeyInterceptor>();
            });

            builder.Services.AddTransient<ServiceKeyInterceptor>();

            // CORS
            builder.Services.AddCors(options =>
            {
                options.AddPolicy("FrondEndAPI", policy =>
                {
                    policy
                        .WithOrigins("http://localhost:5173")
                        .AllowAnyMethod()
                        .AllowAnyHeader();
                });
            });

            // Authentication and Authorization
            builder.Services.AddAuthorization();

            var app = builder.Build();

            // Initialize database data
            await using (var scope = app.Services.CreateAsyncScope())
            {
                var initializer =
                    scope.ServiceProvider.GetRequiredService<DbInitializer>();

                await initializer.SeedAdminAsync();
                await initializer.SeedParkingStaff();
            }

            // Configure the HTTP request pipeline.
            if (app.Environment.IsDevelopment())
            {
                app.MapOpenApi();
            }

            app.UseMiddleware<GlobalExceptionMiddleware>();

            app.UseHttpsRedirection();

            app.UseCors("FrondEndAPI");
            app.UseRateLimiter();

            app.UseAuthentication();
            app.UseAuthorization();

            // Health checks
            app.MapGet("/health/live", () => Results.Ok(new { service = "identity", status = "live" }));
            app.MapGet("/health/ready", async (ParkingDatabaseV4Context db, CancellationToken ct) =>
            {
                try
                {
                    var canConnect = await db.Database.CanConnectAsync(ct);
                    return canConnect
                        ? Results.Ok(new { service = "identity", status = "ready" })
                        : Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
                }
                catch
                {
                    return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
                }
            });

            // REST API
            app.MapControllers().RequireRateLimiting("general-rate-limit");

            // gRPC service
            app.MapGrpcService<FacilityAuthorizationGrpc>();

            app.Run();
        }
    }
}