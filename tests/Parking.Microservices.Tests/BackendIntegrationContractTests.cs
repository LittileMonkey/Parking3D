using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Net.Sockets;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Microsoft.IdentityModel.Tokens;
using Npgsql;
using Parking.Parking.Application.DTOs;
using Parking.ServiceDefaults;
using Xunit;

namespace Parking.Microservices.Tests;

public sealed partial class ParkingWorkflowTests
{
    private const string EvidencePng = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZAAAAABJRU5ErkJggg==";

    [ParkingHttpFact]
    public async Task EvidenceHttpRoundTripIsPrivateAndIdempotent()
    {
        await WithEvidenceHttp(async (http, staffToken, customerToken) =>
        {
            var route = $"/api/v1/parking-lots/{Lot}/evidence";
            var image = new { contentType = "image/png", imageBase64 = EvidencePng };
            async Task<HttpResponseMessage> Upload(string? token, string? key, object? payload = null)
            {
                using var request = new HttpRequestMessage(HttpMethod.Post, route) { Content = JsonContent.Create(payload ?? image) };
                if (token is not null) request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
                if (key is not null) request.Headers.Add("Idempotency-Key", key);
                return await http.SendAsync(request);
            }

            using var anonymous = await Upload(null, "anonymous");
            Assert.Equal(HttpStatusCode.Unauthorized, anonymous.StatusCode);
            using var denied = await Upload(customerToken, "customer");
            Assert.Equal(HttpStatusCode.Forbidden, denied.StatusCode);
            using var missingKey = await Upload(staffToken, null);
            Assert.Equal(HttpStatusCode.BadRequest, missingKey.StatusCode);
            using var first = await Upload(staffToken, "image-once");
            Assert.Equal(HttpStatusCode.Created, first.StatusCode);
            using var replay = await Upload(staffToken, "image-once");
            Assert.Equal(HttpStatusCode.Created, replay.StatusCode);
            var firstBody = await first.Content.ReadAsStringAsync();
            Assert.Equal(firstBody, await replay.Content.ReadAsStringAsync());
            using var body = JsonDocument.Parse(firstBody);
            var metadata = body.RootElement.GetProperty("result");
            var id = metadata.GetProperty("evidenceId").GetGuid();
            Assert.Equal($"parking-evidence:{id}", metadata.GetProperty("reference").GetString());
            using var changed = await Upload(staffToken, "image-once", new { contentType = "image/png", imageBase64 = EvidencePng + " " });
            Assert.Equal(HttpStatusCode.Created, changed.StatusCode);
            var differentBytes = Convert.FromBase64String(EvidencePng).Append((byte)0).ToArray();
            using var conflict = await Upload(staffToken, "image-once", new { contentType = "image/png", imageBase64 = Convert.ToBase64String(differentBytes) });
            Assert.Equal(HttpStatusCode.Conflict, conflict.StatusCode);
            using var invalid = await Upload(staffToken, "invalid", new { contentType = "image/jpeg", imageBase64 = EvidencePng });
            Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);
            using var invalidBase64 = await Upload(staffToken, "invalid-base64", new { contentType = "image/png", imageBase64 = "%%%" });
            Assert.Equal(HttpStatusCode.BadRequest, invalidBase64.StatusCode);
            Assert.Equal(1L, await Scalar("SELECT count(*) FROM incident_evidence_images"));

            using var readRequest = new HttpRequestMessage(HttpMethod.Get, route + "/" + id);
            readRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", staffToken);
            using var read = await http.SendAsync(readRequest);
            Assert.Equal(HttpStatusCode.OK, read.StatusCode);
            using var content = JsonDocument.Parse(await read.Content.ReadAsStringAsync());
            Assert.Equal(EvidencePng, content.RootElement.GetProperty("result").GetProperty("imageBase64").GetString());
            using var wrongLot = new HttpRequestMessage(HttpMethod.Get, $"/api/v1/parking-lots/22222222-2222-4222-8222-222222222222/evidence/{id}");
            wrongLot.Headers.Authorization = new AuthenticationHeaderValue("Bearer", staffToken);
            using var wrongLotResponse = await http.SendAsync(wrongLot);
            Assert.Equal(HttpStatusCode.Forbidden, wrongLotResponse.StatusCode);
            await using var identity = new NpgsqlConnection(identityConnection);
            await identity.OpenAsync();
            await new NpgsqlCommand("UPDATE lot_staff_assignments SET revoked_at=now()", identity).ExecuteNonQueryAsync();
            using var revokedRequest = new HttpRequestMessage(HttpMethod.Get, route + "/" + id);
            revokedRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", staffToken);
            using var revoked = await http.SendAsync(revokedRequest);
            Assert.Equal(HttpStatusCode.Forbidden, revoked.StatusCode);
        });
    }

    [PostgresFact]
    public async Task StoredEvidenceIsDurableScopedAndAcceptedByCheckIn()
    {
        var request = new UploadIncidentEvidenceRequestDto("image/png", EvidencePng);
        var images = await Task.WhenAll(Enumerable.Range(0, 6).Select(_ =>
            repository.UploadIncidentEvidenceAsync(Lot, Staff, request, "same-image", Ct)));
        Assert.Single(images.Select(image => image.EvidenceId).Distinct());
        Assert.Equal(1L, await Scalar("SELECT count(*) FROM incident_evidence_images"));
        Assert.Equal(1L, await Scalar("SELECT count(*) FROM audit_logs WHERE action='UPLOAD_INCIDENT_EVIDENCE'"));
        var reference = images[0].Reference;
        var otherLot = Guid.Parse("22222222-2222-4222-8222-222222222222");
        Assert.Null(await repository.ReadIncidentEvidenceAsync(otherLot, images[0].EvidenceId, Ct));
        var error = await Assert.ThrowsAsync<ServiceException>(() => repository.CreateIncidentAsync(otherLot, Staff,
            new CreateIncidentRequestDto("Gate issue", "GATE", "Medium", "Inspect gate", DateTimeOffset.UtcNow,
                Evidence: [new IncidentEvidenceDto("CAMERA", reference, null)]), "wrong-lot-image", Ct));
        Assert.Equal(404, error.StatusCode);
        Assert.Equal(0L, await Scalar("SELECT count(*) FROM parking_issues"));

        var token = await ConfirmAndIssue(await Book());
        await Enter(token, "stored-photo-override", Request(token) with
        {
            DetectedPlate = "51B54321", AllowMismatchOverride = true,
            OverrideReason = "Staff verified vehicle registration",
            Evidence = [new IncidentEvidenceDto("CAMERA_SNAPSHOT", reference, null)]
        });
        Assert.Equal(reference, await Scalar("SELECT evidence->0->>'reference' FROM parking_issues WHERE issue_type='INCIDENT_0482_PLATE_MISMATCH'"));
        await using var reopenedData = NpgsqlDataSource.Create(parkingConnection);
        var reopened = new global::Parking.Parking.Persistence.Repositories.ParkingRepository(reopenedData, TimeProvider.System);
        var stored = await reopened.ReadIncidentEvidenceAsync(Lot, images[0].EvidenceId, Ct);
        Assert.Equal(EvidencePng, stored!.ImageBase64);
    }

    [PostgresFact]
    public async Task EvidenceMigrationIsRepeatableAndOversizedImagesAreRejected()
    {
        var migration = await File.ReadAllTextAsync(Path.Combine(FindRoot(), "database/services/parking/migrations/010_incident_evidence.sql"));
        await Sql(migration);
        await Sql(migration);
        var tooLarge = new byte[4 * 1024 * 1024 + 1];
        var error = await Assert.ThrowsAsync<ServiceException>(() => repository.UploadIncidentEvidenceAsync(Lot, Staff,
            new UploadIncidentEvidenceRequestDto("image/png", Convert.ToBase64String(tooLarge)), "too-large", Ct));
        Assert.Equal(400, error.StatusCode);
        Assert.Equal(0L, await Scalar("SELECT count(*) FROM incident_evidence_images"));
    }

    [PostgresFact]
    public async Task DockerDemoFixtureCanBeRepeatedWithExistingDemoData()
    {
        var fixture = await File.ReadAllTextAsync(Path.Combine(FindRoot(), "database/services/parking/004_docker_demo.sql"));
        fixture = fixture.Replace(":'customer_id'::uuid", $"'{Customer}'::uuid")
            .Replace(":'admin_id'::uuid", $"'{Staff}'::uuid");
        await Sql(fixture);
        await Sql(fixture);
        Assert.Equal(3L, await Scalar("SELECT count(*) FROM map_versions WHERE status='PUBLISHED'"));
        Assert.Equal(0L, await Scalar("""
            SELECT count(*) FROM parking_slots s
            WHERE NOT EXISTS(SELECT 1 FROM map_objects m JOIN map_versions v ON v.id=m.map_version_id
                WHERE m.slot_id=s.id AND m.lot_id=s.lot_id AND v.status='PUBLISHED')
            """));
        Assert.Equal(6L, await Scalar("SELECT count(*) FROM lot_vehicle_policies WHERE vehicle_type IN ('CAR','MOTORBIKE')"));
    }

    [ParkingHttpFact]
    public async Task IncidentAndHandoverWritesRequireIdempotencyHeader()
    {
        await WithEvidenceHttp(async (http, staffToken, _) =>
        {
            http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", staffToken);
            var root = $"/api/v1/parking-lots/{Lot}";
            var id = Guid.NewGuid();
            var writes = new (HttpMethod Method, string Route, object Body)[]
            {
                (HttpMethod.Post, root + "/incidents", new { title = "Gate", type = "GATE", severity = "Medium", description = "Inspect gate", detectedAt = DateTimeOffset.UtcNow }),
                (HttpMethod.Patch, root + $"/incidents/{id}/status", new { status = "InProgress", expectedVersion = 1 }),
                (HttpMethod.Post, root + $"/incidents/{id}/reopen", new { reason = "Check again", expectedVersion = 1 }),
                (HttpMethod.Post, root + $"/incidents/{id}/cancel", new { reason = "Duplicate report", expectedVersion = 1 }),
                (HttpMethod.Post, root + $"/incidents/{id}/decisions", new { decision = "Rejected", reason = "Review failed", evidence = Array.Empty<object>(), expectedVersion = 1 }),
                (HttpMethod.Post, root + "/shift-handovers", new { senderShiftId = id, receiverShiftId = Guid.NewGuid(), receiverUserId = Guid.NewGuid(), completedTasks = "Done", unresolvedIssues = "None", pendingTransactions = "None", notesForNext = "Inspect gate" }),
                (HttpMethod.Post, root + $"/shift-handovers/{id}/confirm", new { expectedVersion = 1 }),
                (HttpMethod.Patch, root + $"/shift-handovers/{id}/receiver", new { receiverUserId = Guid.NewGuid(), reason = "Receiver absent", expectedVersion = 1 })
            };
            foreach (var write in writes)
            {
                using var request = new HttpRequestMessage(write.Method, write.Route) { Content = JsonContent.Create(write.Body) };
                using var response = await http.SendAsync(request);
                Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
                using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
                Assert.Equal("IDEMPOTENCY_KEY_REQUIRED", body.RootElement.GetProperty("errorCode").GetString());
            }
        });
    }

    private async Task WithEvidenceHttp(Func<HttpClient, string, string, Task> verify)
    {
        var listeners = Enumerable.Range(0, 4).Select(_ => new TcpListener(IPAddress.Loopback, 0)).ToArray();
        foreach (var listener in listeners) listener.Start();
        var ports = listeners.Select(listener => ((IPEndPoint)listener.LocalEndpoint).Port).ToArray();
        foreach (var listener in listeners) listener.Stop();
        var secret = Guid.NewGuid().ToString("N") + Guid.NewGuid().ToString("N");
        var settings = new Dictionary<string, string>
        {
            ["ASPNETCORE_ENVIRONMENT"] = "Development", ["Jwt__Key"] = secret,
            ["Grpc__ServiceKey"] = secret, ["Qr__SigningKey"] = secret,
            ["Services__IdentityGrpc"] = $"http://127.0.0.1:{ports[1]}",
            ["SeedAdmin__Email"] = "evidence.admin@example.test", ["SeedAdmin__Password"] = "Test-" + secret,
            ["SeedAdmin__FullName"] = "Evidence test administrator",
            ["SeedStaff__Email"] = "evidence.staff@example.test", ["SeedStaff__Password"] = "Test-" + secret,
            ["SeedStaff__FullName"] = "Evidence test staff",
            ["ConnectionStrings__Service"] = identityConnection,
            ["ConnectionStrings__DefaultConnectionString"] = identityConnection
        };
        using var identity = new LocalHost(Environment.GetEnvironmentVariable("PARKING_TEST_IDENTITY_DLL")!, ports[0], ports[1], settings);
        var parkingSettings = new Dictionary<string, string>(settings)
        {
            ["ConnectionStrings__Service"] = parkingConnection,
            ["ConnectionStrings__DefaultConnectionString"] = parkingConnection
        };
        using var parking = new LocalHost(Environment.GetEnvironmentVariable("PARKING_TEST_API_DLL")!, ports[2], ports[3], parkingSettings);
        await identity.WaitUntilStarted();
        await parking.WaitUntilStarted();
        using var http = new HttpClient { BaseAddress = new Uri($"http://127.0.0.1:{ports[2]}") };
        string Token(Guid actor) => new JwtSecurityTokenHandler().WriteToken(new JwtSecurityToken(
            issuer: "parking-identity", audience: "parking-api", claims: [new Claim("sub", actor.ToString())],
            expires: DateTime.UtcNow.AddMinutes(10), signingCredentials: new SigningCredentials(
                new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret)), SecurityAlgorithms.HmacSha256)));
        await verify(http, Token(Staff), Token(Customer));
    }
}
