using System.Collections.Concurrent;
using System.Diagnostics;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Net.Sockets;
using System.Text.Json;
using Grpc.Core;
using Grpc.Net.Client;
using Microsoft.AspNetCore.Identity;
using Npgsql;
using Parking.Contracts.Payments.V1;
using Parking.Identity.Domain.Entities;
using Parking.Parking.Application;
using Parking.Parking.Application.DTOs;
using Xunit;

namespace Parking.Microservices.Tests;

public sealed class ParkingHttpFactAttribute : FactAttribute
{
    public ParkingHttpFactAttribute()
    {
        if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("PARKING_TEST_ADMIN_CONNECTION")) ||
            !File.Exists(Environment.GetEnvironmentVariable("PARKING_TEST_API_DLL")) ||
            !File.Exists(Environment.GetEnvironmentVariable("PARKING_TEST_IDENTITY_DLL")))
            Skip = "Set local test DB connection and PARKING_TEST_API_DLL / PARKING_TEST_IDENTITY_DLL to freshly built hosts.";
    }
}

public sealed partial class ParkingWorkflowTests
{
    [ParkingHttpFact]
    [Trait("Dependency", "IdentityIntegration")]
    public async Task RealHttpJwtGrpcScopePaymentAndSingleUseQrWorkflow()
    {
        var password = "Test-" + Guid.NewGuid().ToString("N") + "!";
        var hasher = new PasswordHasher<AppUser>();
        var hash = hasher.HashPassword(new AppUser(), password);
        await using (var identity = new NpgsqlConnection(identityConnection))
        {
            await identity.OpenAsync();
            await using var command = new NpgsqlCommand("""
                UPDATE app_users SET password_hash=@hash,
                  email_normalized=CASE WHEN id=@customer THEN 'CUSTOMER@EXAMPLE.TEST' ELSE 'STAFF@EXAMPLE.TEST' END
                """, identity);
            command.Parameters.AddWithValue("hash", hash); command.Parameters.AddWithValue("customer", Customer);
            await command.ExecuteNonQueryAsync();
        }
        // Allocate all ports together so their numbers cannot overlap.
        var listeners = Enumerable.Range(0, 4).Select(_ => new TcpListener(IPAddress.Loopback, 0)).ToArray();
        foreach (var listener in listeners) listener.Start();
        var ports = listeners.Select(listener => ((IPEndPoint)listener.LocalEndpoint).Port).ToArray();
        foreach (var listener in listeners) listener.Stop();
        var serviceKey = Guid.NewGuid().ToString("N") + Guid.NewGuid().ToString("N");
        var jwtKey = Guid.NewGuid().ToString("N") + Guid.NewGuid().ToString("N");
        var settings = new Dictionary<string, string>
        {
            ["DOTNET_ENVIRONMENT"] = "Development", ["ASPNETCORE_ENVIRONMENT"] = "Development",
            ["Jwt__Key"] = jwtKey, ["Jwt__Issuer"] = "parking-identity", ["Jwt__Audience"] = "parking-api",
            ["Jwt__AccessTokenExpirationMinutes"] = "30", ["Grpc__ServiceKey"] = serviceKey,
            ["ConnectionStrings__DefaultConnectionString"] = identityConnection,
            ["ConnectionStrings__Service"] = parkingConnection,
            ["SeedAccounts__Enabled"] = "false", ["Qr__SigningKey"] = Guid.NewGuid().ToString("N") + Guid.NewGuid().ToString("N"),
            ["Services__IdentityGrpc"] = $"http://127.0.0.1:{ports[1]}"
        };
        using var identityHost = new LocalHost(Environment.GetEnvironmentVariable("PARKING_TEST_IDENTITY_DLL")!, ports[0], ports[1], settings);
        using var parkingHost = new LocalHost(Environment.GetEnvironmentVariable("PARKING_TEST_API_DLL")!, ports[2], ports[3], settings);
        await identityHost.WaitUntilStarted(); await parkingHost.WaitUntilStarted();
        using var identityHttp = new HttpClient { BaseAddress = new Uri($"http://127.0.0.1:{ports[0]}"), Timeout = TimeSpan.FromSeconds(10) };
        using var http = new HttpClient { BaseAddress = new Uri($"http://127.0.0.1:{ports[2]}"), Timeout = TimeSpan.FromSeconds(10) };
        async Task<string> Login(string email)
        {
            using var response = await identityHttp.PostAsJsonAsync("/api/v1/auth/login", new { emailNormalized = email, password });
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            return json.RootElement.GetProperty("result").GetProperty("accessToken").GetString()!;
        }
        var ownerToken = await Login("customer@example.test");
        var staffToken = await Login("staff@example.test");
        async Task<HttpResponseMessage> Post(string path, object body, string? bearer, string? key = null)
        {
            var message = new HttpRequestMessage(HttpMethod.Post, path) { Content = JsonContent.Create(body) };
            if (bearer is not null) message.Headers.Authorization = new AuthenticationHeaderValue("Bearer", bearer);
            if (key is not null) message.Headers.Add("Idempotency-Key", key);
            return await http.SendAsync(message);
        }
        Assert.Equal(HttpStatusCode.OK, (await http.GetAsync("/health/ready")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Post("/api/v1/check-in", new { }, null)).StatusCode);
        var bookingRequest = new BookingRequest(Lot, Slot, Vehicle, DateTimeOffset.UtcNow.AddMinutes(2), DateTimeOffset.UtcNow.AddMinutes(62));
        using var created = await Post("/api/v1/bookings", bookingRequest, ownerToken, "http-booking");
        Assert.Equal(HttpStatusCode.OK, created.StatusCode);
        var bookingJson = JsonDocument.Parse(await created.Content.ReadAsStringAsync());
        var bookingId = bookingJson.RootElement.GetProperty("result").GetProperty("id").GetGuid();
        var amount = bookingJson.RootElement.GetProperty("result").GetProperty("estimatedAmount").GetInt64();
        var qrRoute = $"/api/v1/bookings/{bookingId}/qr";
        using (var detailRequest = new HttpRequestMessage(HttpMethod.Get, $"/api/v1/bookings/{bookingId}"))
        {
            detailRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", ownerToken);
            using var detail = await http.SendAsync(detailRequest);
            Assert.Equal(HttpStatusCode.OK, detail.StatusCode);
        }
        Assert.Equal(HttpStatusCode.Unauthorized, (await Post(qrRoute, new { }, null)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await Post(qrRoute, new { }, ownerToken)).StatusCode);
        using var channel = GrpcChannel.ForAddress($"http://127.0.0.1:{ports[3]}");
        var payments = new ParkingPaymentEvents.ParkingPaymentEventsClient(channel);
        var payment = new PaymentSucceeded
        {
            EventId = Guid.NewGuid().ToString(), PaymentId = Guid.NewGuid().ToString(), BookingId = bookingId.ToString(),
            LotId = Lot.ToString(), AmountMinor = amount, Currency = "VND", PaidAtUnixSeconds = DateTimeOffset.UtcNow.ToUnixTimeSeconds()
        };
        Assert.Equal("CONFIRMED", (await payments.DeliverPaymentSucceededAsync(payment, new Metadata { { "x-service-key", serviceKey } })).Outcome);
        using var issued = await Post(qrRoute, new { }, ownerToken);
        Assert.Equal(HttpStatusCode.OK, issued.StatusCode);
        var ticket = JsonDocument.Parse(await issued.Content.ReadAsStringAsync()).RootElement.GetProperty("result").GetProperty("qrPayload").GetString()!;
        var entry = new CheckInRequestDto(Lot, Gate, ticket, "51A-123.45");
        Assert.Equal(HttpStatusCode.Forbidden, (await Post("/api/v1/check-in", entry, ownerToken, "customer-scan")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await Post("/api/v1/check-in", entry with { LotId = Guid.NewGuid() }, staffToken, "wrong-lot")).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await Post("/api/v1/check-in", entry with { DetectedPlate = "WRONG" }, staffToken, "wrong-plate")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Post("/api/v1/check-in", entry, staffToken)).StatusCode);
        using var success = await Post("/api/v1/check-in", entry, staffToken, "entry-once");
        Assert.Equal(HttpStatusCode.OK, success.StatusCode);
        using var retry = await Post("/api/v1/check-in", entry, staffToken, "entry-once");
        Assert.Equal(HttpStatusCode.OK, retry.StatusCode);
        Assert.Equal(await success.Content.ReadAsStringAsync(), await retry.Content.ReadAsStringAsync());
        Assert.Equal(HttpStatusCode.Conflict, (await Post("/api/v1/check-in", entry, staffToken, "reused-qr")).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await Post(qrRoute, new { }, ownerToken)).StatusCode);
        using var availability = await http.GetAsync($"/api/v1/parking-lots/{Lot}/availability?vehicleType=CAR");
        Assert.Equal(HttpStatusCode.OK, availability.StatusCode);
        var view = JsonDocument.Parse(await availability.Content.ReadAsStringAsync());
        Assert.Equal(1, view.RootElement.GetProperty("result").GetProperty("occupiedCount").GetInt32());
        Assert.Equal(1L, await Scalar("SELECT count(*) FROM parking_sessions"));

        using var escalation = await identityHttp.PostAsJsonAsync("/api/v1/auth/register", new
        { emailNormalized = "intruder@example.test", phoneE164 = "+84900000099", fullName = "Test", password, roles = new[] { "ADMIN" } });
        Assert.Equal(HttpStatusCode.BadRequest, escalation.StatusCode);

        // Another Customer cannot read or issue the first Customer's ticket.
        using var register = await identityHttp.PostAsJsonAsync("/api/v1/auth/register", new
        { emailNormalized = "other@example.test", phoneE164 = "+84900000098", fullName = "Other Customer", password, roles = new[] { "CUSTOMER" } });
        Assert.Equal(HttpStatusCode.OK, register.StatusCode);
        var otherToken = await Login("other@example.test");
        Assert.Equal(HttpStatusCode.Forbidden, (await Post(qrRoute, new { }, otherToken)).StatusCode);
        using var lookupRequest = new HttpRequestMessage(HttpMethod.Get, $"/api/v1/bookings/{bookingId}");
        lookupRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", otherToken);
        using var deniedLookup = await http.SendAsync(lookupRequest);
        Assert.Equal(HttpStatusCode.Forbidden, deniedLookup.StatusCode);
    }

    private sealed class LocalHost : IDisposable
    {
        private readonly Process process;
        private readonly ConcurrentQueue<string> logs = new();
        private readonly int httpPort;
        public LocalHost(string dll, int httpPort, int grpcPort, Dictionary<string, string> settings)
        {
            this.httpPort = httpPort;
            var start = new ProcessStartInfo("dotnet")
            { UseShellExecute = false, CreateNoWindow = true, RedirectStandardOutput = true, RedirectStandardError = true, WorkingDirectory = FindRoot() };
            start.ArgumentList.Add(dll);
            start.ArgumentList.Add($"--Ports:Http={httpPort}"); start.ArgumentList.Add($"--Ports:Grpc={grpcPort}");
            foreach (var (name, value) in settings) start.Environment[name] = value;
            process = new Process { StartInfo = start };
            process.OutputDataReceived += (_, item) => { if (item.Data is not null) logs.Enqueue(item.Data); };
            process.ErrorDataReceived += (_, item) => { if (item.Data is not null) logs.Enqueue(item.Data); };
            process.Start(); process.BeginOutputReadLine(); process.BeginErrorReadLine();
        }
        public async Task WaitUntilStarted()
        {
            using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(1) };
            var watch = Stopwatch.StartNew();
            while (watch.Elapsed < TimeSpan.FromSeconds(30))
            {
                if (process.HasExited) throw new InvalidOperationException("Test host exited: " + string.Join(Environment.NewLine, logs.TakeLast(12)));
                try { using var response = await client.GetAsync($"http://127.0.0.1:{httpPort}/__test_started"); return; }
                catch (Exception exception) when (exception is HttpRequestException or TaskCanceledException) { }
                await Task.Delay(200);
            }
            throw new TimeoutException("Test host failed to listen: " + string.Join(Environment.NewLine, logs.TakeLast(12)));
        }
        public void Dispose()
        {
            if (!process.HasExited) { process.Kill(entireProcessTree: true); process.WaitForExit(5000); }
            process.Dispose();
        }
    }
}
