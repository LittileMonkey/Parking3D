using Parking.Identity.Infrastructure;
using Parking.Identity.Persistence;
using Parking.Identity.Application;
using Parking.Identity.Api.Middleware;
using Parking.Identity.Infrastructure.Initializer;
using Identity.Infrastructure;
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

            var app = builder.Build();

            using (var scope = app.Services.CreateAsyncScope())
            {
                var initializer = scope.ServiceProvider.GetRequiredService<DbInitializer>();
                await initializer.SeedAdminAsync();
            }

            // Configure the HTTP request pipeline.
            if (app.Environment.IsDevelopment())
            {
                app.MapOpenApi();
            }

            app.UseMiddleware<GlobalExceptionMiddleware>();

            app.UseHttpsRedirection();

            app.UseAuthentication();
            app.UseAuthorization();


            app.MapControllers();

            app.Run();
        }
    }
}
