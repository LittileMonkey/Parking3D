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

            builder.WebHost.ConfigureKestrel(k =>
            {
                var bind = builder.Configuration["Ports:Bind"] == "0.0.0.0" ? IPAddress.Any : IPAddress.Loopback;
                k.Listen(bind, builder.Configuration.GetValue("Ports:Http", 8080), o => o.Protocols = HttpProtocols.Http1);
                k.Listen(bind, builder.Configuration.GetValue("Ports:Grpc", 8081), o => o.Protocols = HttpProtocols.Http2);
            });

            // Add services to the container.

            builder.Services.AddControllers();
            // Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
            builder.Services.AddOpenApi();

            builder.Services.AddPersistenceDependencyInjection(builder.Configuration);
            builder.Services.AddInfrastructureDependencyInjection(builder.Configuration);
            builder.Services.AddApplicationDependencyInjection(builder.Configuration);

            builder.Services.AddGrpc(o => { o.Interceptors.Add<ServiceKeyInterceptor>(); });
            builder.Services.AddTransient<ServiceKeyInterceptor>();

            builder.Services.AddCors(options => options.AddPolicy("FrondEndAPI", policy => {
                policy.AllowAnyOrigin("http://localhost:5173");
                policy.AllowAnyMethod();
                policy.AllowAnyHeader();
            }));
            builder.Services.AddAuthorization();

            var app = builder.Build();

            using (var scope = app.Services.CreateAsyncScope())
            {
                var initializer = scope.ServiceProvider.GetRequiredService<DbInitializer>();
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


            app.MapControllers();
            app.MapGrpcService<FacilityAuthorizationGrpc>();

            app.Run();
        }
    }
}
