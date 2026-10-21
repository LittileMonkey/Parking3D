using System.Net;
using Microsoft.AspNetCore.Server.Kestrel.Core;
using Parking.Identity.Infrastructure;
using Parking.Identity.Persistence;
using Parking.Identity.Application;
using Parking.Identity.Api.Middleware;
using Parking.Identity.Infrastructure.Initializer;
using Identity.Infrastructure;
using Parking.ServiceDefaults;

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

            app.UseAuthentication();
            app.UseAuthorization();

            // REST API
            app.MapControllers();

            // gRPC service
            app.MapGrpcService<FacilityAuthorizationGrpc>();

            app.Run();
        }
    }
}