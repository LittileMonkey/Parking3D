using Identity.Infrastructure;
using Parking.Identity.Api.Middleware;
using Parking.Identity.Application;
using Parking.Identity.Infrastructure.Initializer;
using Parking.Identity.Persistence;
namespace Parking.Identity.Api
{
    public class Program
    {
        public static async Task Main(string[] args)
        {
            var builder = WebApplication.CreateBuilder(args);

            // Add services to the container.

            builder.Services.AddControllers();
            // Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
            builder.Services.AddOpenApi();

            builder.Services.AddPersistenceDependencyInjection(builder.Configuration);
            builder.Services.AddInfrastructureDependencyInjection(builder.Configuration);
            builder.Services.AddApplicationDependencyInjection(builder.Configuration);

            builder.Services.AddAuthorization();

            builder.Services.AddCors(otpions => otpions.AddPolicy("FrontendPolicy", policy =>
            {
                policy
                .WithOrigins("http://localhost:5173")
                .AllowAnyHeader()
                .AllowAnyMethod();

            }));

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

            app.UseCors("FrontendPolicy");
            app.UseAuthentication();
            app.UseAuthorization();


            app.MapControllers();

            app.Run();
        }
    }
}
