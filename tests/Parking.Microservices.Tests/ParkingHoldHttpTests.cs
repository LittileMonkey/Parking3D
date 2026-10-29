using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Grpc.Core;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Server.Kestrel.Core;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;
using Parking.Contracts.Identity.V1;
using Parking.Parking.Application;
using Xunit;

namespace Parking.Microservices.Tests;

public sealed class ParkingHoldHttpFactAttribute : FactAttribute
{
    public ParkingHoldHttpFactAttribute()
    {
        if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("PARKING_TEST_ADMIN_CONNECTION")) ||
            !File.Exists(Environment.GetEnvironmentVariable("PARKING_TEST_API_DLL")))
            Skip = "Set local test DB connection and PARKING_TEST_API_DLL to the freshly built Parking host.";
    }
}

public sealed partial class ParkingWorkflowTests
{
    [ParkingHoldHttpFact]
    public async Task HoldHttpCreateReadAndReplayExposeTheSameFiveMinuteDeadline()
    {
        var jwtKey = Guid.NewGuid().ToString("N") + Guid.NewGuid().ToString("N");
        var serviceKey = Guid.NewGuid().ToString("N") + Guid.NewGuid().ToString("N");
        var builder = WebApplication.CreateBuilder();
        builder.Logging.ClearProviders();
        builder.WebHost.ConfigureKestrel(options =>
            options.Listen(IPAddress.Loopback, 0, endpoint => endpoint.Protocols = HttpProtocols.Http2));
        builder.Services.AddGrpc();
        builder.Services.AddSingleton(new HoldAuthorizationStub(serviceKey));
        await using var authorizationHost = builder.Build();
        authorizationHost.MapGrpcService<HoldAuthorizationStub>();
        await authorizationHost.StartAsync();

        var listeners = Enumerable.Range(0, 2)
            .Select(_ => new System.Net.Sockets.TcpListener(IPAddress.Loopback, 0)).ToArray();
        foreach (var listener in listeners) listener.Start();
        var ports = listeners.Select(listener => ((IPEndPoint)listener.LocalEndpoint).Port).ToArray();
        foreach (var listener in listeners) listener.Stop();
        var settings = new Dictionary<string, string>
        {
            ["DOTNET_ENVIRONMENT"] = "Development", ["ASPNETCORE_ENVIRONMENT"] = "Development",
            ["Jwt__Key"] = jwtKey, ["Jwt__Issuer"] = "parking-identity",
            ["Grpc__ServiceKey"] = serviceKey, ["ConnectionStrings__Service"] = parkingConnection,
            ["Qr__SigningKey"] = Guid.NewGuid().ToString("N") + Guid.NewGuid().ToString("N"),
            ["Services__IdentityGrpc"] = authorizationHost.Urls.Single(),
            ["Services__AIGrpc"] = authorizationHost.Urls.Single()
        };
        using var parkingHost = new LocalHost(Environment.GetEnvironmentVariable("PARKING_TEST_API_DLL")!, ports[0], ports[1], settings);
        await parkingHost.WaitUntilStarted();
        using var http = new HttpClient { BaseAddress = new Uri($"http://127.0.0.1:{ports[0]}"), Timeout = TimeSpan.FromSeconds(10) };
        Assert.Equal(HttpStatusCode.OK, (await http.GetAsync("/health/ready")).StatusCode);
        var token = new JwtSecurityToken("parking-identity", "parking-api",
            [new Claim("sub", Customer.ToString())], DateTime.UtcNow.AddMinutes(-1), DateTime.UtcNow.AddMinutes(10),
            new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)), SecurityAlgorithms.HmacSha256));
        http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", new JwtSecurityTokenHandler().WriteToken(token));
        http.DefaultRequestHeaders.Add("Idempotency-Key", "hold-http-replay");
        var request = new BookingRequest(Lot, Slot, Vehicle, DateTimeOffset.UtcNow.AddMinutes(10), DateTimeOffset.UtcNow.AddMinutes(70));
        var before = DateTimeOffset.UtcNow;
        using var created = await http.PostAsJsonAsync("/api/v1/bookings", request);
        var after = DateTimeOffset.UtcNow;
        Assert.Equal(HttpStatusCode.OK, created.StatusCode);
        using var createdJson = JsonDocument.Parse(await created.Content.ReadAsStringAsync());
        Assert.True(createdJson.RootElement.GetProperty("isSuccess").GetBoolean());
        Assert.Equal(200, createdJson.RootElement.GetProperty("statusCode").GetInt32());
        var result = createdJson.RootElement.GetProperty("result");
        var bookingId = result.GetProperty("id").GetGuid();
        var deadline = result.GetProperty("holdExpiresAt").GetDateTimeOffset();
        Assert.InRange(deadline, before.AddMinutes(5), after.AddMinutes(5));

        using var detail = await http.GetAsync($"/api/v1/bookings/{bookingId}");
        Assert.Equal(HttpStatusCode.OK, detail.StatusCode);
        using var detailJson = JsonDocument.Parse(await detail.Content.ReadAsStringAsync());
        var storedDeadline = detailJson.RootElement.GetProperty("result").GetProperty("holdExpiresAt").GetDateTimeOffset();
        Assert.InRange(Math.Abs((deadline - storedDeadline).TotalMilliseconds), 0d, 1d);
        using var replay = await http.PostAsJsonAsync("/api/v1/bookings", request);
        Assert.Equal(HttpStatusCode.OK, replay.StatusCode);
        using var replayJson = JsonDocument.Parse(await replay.Content.ReadAsStringAsync());
        Assert.Equal(deadline, replayJson.RootElement.GetProperty("result").GetProperty("holdExpiresAt").GetDateTimeOffset());
        Assert.Equal(1L, await Scalar("SELECT count(*) FROM bookings"));
    }

    // Identity is a test double here; JWT validation, Parking HTTP, gRPC transport and PostgreSQL are real.
    public sealed class HoldAuthorizationStub(string serviceKey) : FacilityAuthorization.FacilityAuthorizationBase
    {
        public override Task<AccessReply> CheckAccess(AccessRequest request, ServerCallContext context) =>
            Task.FromResult(new AccessReply
            {
                Allowed = context.RequestHeaders.GetValue("x-service-key") == serviceKey
                    && request.UserId == Customer.ToString() && request.Capability == "USER"
                    && request.LotId == Guid.Empty.ToString()
            });
    }
}
