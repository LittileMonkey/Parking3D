using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace ParkingSystem.Data;

/// <summary>EF CLI reads the same configuration; no password is stored in source.</summary>
public sealed class ParkingDbContextFactory : IDesignTimeDbContextFactory<ParkingDbContext>
{
    public ParkingDbContext CreateDbContext(string[] args)
    {
        var environment = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Development";
        var configuration = new ConfigurationBuilder()
            .SetBasePath(Directory.GetCurrentDirectory())
            .AddJsonFile("appsettings.json", optional: true)
            .AddJsonFile($"appsettings.{environment}.json", optional: true);
        if (environment == "Development")
            configuration.AddUserSecrets<ParkingDbContextFactory>(optional: true);
        var settings = configuration.AddEnvironmentVariables().AddCommandLine(args).Build();
        var connectionString = settings.GetConnectionString("Parking")
            ?? throw new InvalidOperationException("Configure ConnectionStrings:Parking in User Secrets (Development) or environment variables.");
        return new ParkingDbContext(new DbContextOptionsBuilder<ParkingDbContext>().UseNpgsql(connectionString).Options);
    }
}
