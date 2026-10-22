using Parking.Parking.Application.Interfaces;
using Parking.Parking.Domain;
using Xunit;

namespace Parking.Microservices.Tests;

// Bảo vệ hướng dependency: layer bên trong không được tham chiếu layer triển khai bên ngoài.
public sealed class ParkingArchitectureTests
{
    [Fact]
    public void DomainDoesNotReferenceApplicationOrInfrastructure()
    {
        var references = typeof(PlateNumber).Assembly.GetReferencedAssemblies();
        Assert.DoesNotContain(references, assembly =>
            assembly.Name!.StartsWith("Parking.", StringComparison.Ordinal) ||
            assembly.Name.StartsWith("Microsoft.AspNetCore", StringComparison.Ordinal) ||
            assembly.Name.StartsWith("Microsoft.EntityFrameworkCore", StringComparison.Ordinal) ||
            assembly.Name.StartsWith("Npgsql", StringComparison.Ordinal));
    }

    [Fact]
    public void ApplicationDoesNotReferenceTransportOrPersistence()
    {
        var forbiddenPrefixes = new[]
        {
            "Parking.Parking.Api", "Parking.Parking.Infrastructure", "Parking.Parking.Persistence",
            "Parking.Identity", "Parking.Contracts", "Parking.ServiceDefaults",
            "Microsoft.AspNetCore", "Microsoft.EntityFrameworkCore", "Microsoft.IdentityModel", "Npgsql", "Grpc"
        };
        var references = typeof(IQrTokenService).Assembly.GetReferencedAssemblies();
        Assert.DoesNotContain(references, assembly => forbiddenPrefixes.Any(prefix =>
            assembly.Name!.StartsWith(prefix, StringComparison.Ordinal)));
    }
}
