using System.Net;
using System.Security.Claims;
using System.Text;
using Grpc.Core;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Server.Kestrel.Core;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;
using Npgsql;

namespace Parking.ServiceDefaults;

public static class ServiceSetup
{
    public static void AddParkingDefaults(this WebApplicationBuilder builder)
    {
        builder.Logging.ClearProviders().AddJsonConsole();
        var key = builder.Configuration["Jwt:Key"] ?? "";
        if (key.Length < 32) throw new InvalidOperationException("Jwt:Key must contain at least 32 characters; use secrets/environment.");
        if ((builder.Configuration["Grpc:ServiceKey"] ?? "").Length < 32)
            throw new InvalidOperationException("Grpc:ServiceKey must contain at least 32 characters.");
        builder.WebHost.ConfigureKestrel(k =>
        {
            var bind=builder.Configuration["Ports:Bind"]=="0.0.0.0"?IPAddress.Any:IPAddress.Loopback;
            k.Listen(bind,builder.Configuration.GetValue("Ports:Http", 8080), o => o.Protocols = HttpProtocols.Http1);
            k.Listen(bind,builder.Configuration.GetValue("Ports:Grpc", 8081), o => o.Protocols = HttpProtocols.Http2);
            k.Limits.MaxRequestBodySize = 6 * 1024 * 1024;
        });
        builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(o =>
        {
            o.MapInboundClaims = false;
            o.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = true, ValidIssuer = builder.Configuration["Jwt:Issuer"] ?? "parking-identity",
                ValidateAudience = true, ValidAudience = "parking-api",
                ValidateLifetime = true, ValidateIssuerSigningKey = true,
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)),
                NameClaimType = "sub", RoleClaimType = "role", ClockSkew = TimeSpan.FromSeconds(15)
            };
            o.Events = new JwtBearerEvents
            {
                OnChallenge = async c =>
                {
                    c.HandleResponse(); c.Response.StatusCode = 401;
                    await c.Response.WriteAsJsonAsync(new ApiResponse<object>(null, false, 401, "Authentication required"));
                },
                OnForbidden = async c =>
                {
                    c.Response.StatusCode = 403;
                    await c.Response.WriteAsJsonAsync(new ApiResponse<object>(null, false, 403, "Access denied"));
                }
            };
        });
        builder.Services.AddAuthorization();
        builder.Services.AddSingleton(TimeProvider.System);
        builder.Services.AddSingleton(_ => NpgsqlDataSource.Create(
            builder.Configuration.GetConnectionString("Service") ?? throw new InvalidOperationException("ConnectionStrings:Service missing")));
        builder.Services.AddGrpc(o => { o.Interceptors.Add<ServiceKeyInterceptor>(); o.MaxReceiveMessageSize = 6 * 1024 * 1024; });
        builder.Services.AddTransient<ServiceKeyInterceptor>();
    }

    public static void UseParkingDefaults(this WebApplication app, string serviceName)
    {
        app.Use(async (context, next) =>
        {
            // gRPC owns its transport status; do not wrap protobuf in HTTP JSON.
            if (context.Request.ContentType?.StartsWith("application/grpc", StringComparison.OrdinalIgnoreCase) == true)
            { await next(context); return; }
            try { await next(context); }
            catch (Exception e) when (!context.Response.HasStarted)
            {
                var status = e switch
                {
                    ServiceException x => x.StatusCode,
                    Microsoft.AspNetCore.Http.BadHttpRequestException or ArgumentException or FormatException => 400,
                    PostgresException p when p.SqlState is "23505" or "23P01" or "23514" or "23503" => 409,
                    NpgsqlException => 503,
                    RpcException r => r.StatusCode switch
                    {
                        StatusCode.PermissionDenied => 403, StatusCode.InvalidArgument => 400,
                        StatusCode.AlreadyExists or StatusCode.FailedPrecondition or StatusCode.Aborted => 409,
                        StatusCode.NotFound => 404, _ => 503
                    },
                    OperationCanceledException => 503,
                    _ => 500
                };
                app.Logger.LogWarning("Request failed in {Service}: {ExceptionType}, status {Status}", serviceName, e.GetType().Name, status);
                context.Response.StatusCode = status;
                await context.Response.WriteAsJsonAsync(new ApiResponse<object>(null, false, status,
                    e is ServiceException se ? se.Message : status == 409 ? "State or data constraint conflict" : "Request could not be completed"));
            }
        });
        app.UseAuthentication(); app.UseAuthorization();
        app.MapGet("/health/live", () => Responses.Ok(new { service = serviceName, status = "live" }));
        app.MapGet("/health/ready", async (NpgsqlDataSource data, CancellationToken ct) =>
        {
            try
            {
                await using var command = data.CreateCommand("SELECT version FROM service_schema_versions WHERE version=1");
                var v = await command.ExecuteScalarAsync(ct);
                return v is not null ? Responses.Ok(new { service = serviceName, status = "ready", schemaVersion = 1 })
                    : Responses.Error(503, "Schema migration required");
            }
            catch (NpgsqlException) { return Responses.Error(503, "Database unavailable or migration missing"); }
        });
        app.MapFallback(() => Responses.Error(404, "Endpoint not found"));
    }

    public static Guid Subject(this ClaimsPrincipal user) =>
        Guid.TryParse(user.FindFirstValue("sub"), out var id) && id != Guid.Empty ? id
            : throw new ServiceException(401, "Invalid subject");
}
