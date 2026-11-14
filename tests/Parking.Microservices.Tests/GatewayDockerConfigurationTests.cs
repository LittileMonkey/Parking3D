using System.Text.RegularExpressions;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace Parking.Microservices.Tests;

public sealed class GatewayDockerConfigurationTests
{
    [Theory]
    [InlineData("identity")]
    [InlineData("parking")]
    [InlineData("payment")]
    [InlineData("ai")]
    public void DockerGatewayRoutesAndReadinessUseContainerDns(string service)
    {
        var root = FindRoot();
        var compose = File.ReadAllText(Path.Combine(root, "compose.microservices.yml"));
        var gateway = compose.Split("  gateway:", StringSplitOptions.None)[1];
        var environment = gateway.Split("    environment:", StringSplitOptions.None)[1]
            .Split("    ports:", StringSplitOptions.None)[0];
        // Only the flat gateway environment mapping is needed; never expand or print secrets.
        var overrides = Regex.Matches(environment, @"(?m)^      ([A-Za-z0-9_]+):\s*([^\r\n]+)")
            .ToDictionary(match => match.Groups[1].Value.Replace("__", ":", StringComparison.Ordinal),
                match => (string?)match.Groups[2].Value.Trim().Trim('"', '\''));
        var configuration = new ConfigurationBuilder()
            .AddJsonFile(Path.Combine(root, "src/Gateway/Parking.Gateway/appsettings.json"))
            .AddJsonFile(Path.Combine(root, "src/Gateway/Parking.Gateway/appsettings.Development.json"))
            .AddInMemoryCollection(overrides)
            .Build();

        var destination = new Uri(configuration[$"ReverseProxy:Clusters:{service}:Destinations:main:Address"]!);
        var readiness = new Uri(configuration[$"Services:{service}Http"]!);
        Assert.Equal(service, destination.Host);
        Assert.Equal(8080, destination.Port);
        Assert.Equal(destination, readiness);
        Assert.False(destination.IsLoopback);
    }

    private static string FindRoot()
    {
        var directory = new DirectoryInfo(Environment.GetEnvironmentVariable("PARKING_REPO_ROOT") ?? Directory.GetCurrentDirectory());
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "compose.microservices.yml")))
            directory = directory.Parent;
        return directory?.FullName ?? throw new InvalidOperationException("Repository root was not found.");
    }
}
