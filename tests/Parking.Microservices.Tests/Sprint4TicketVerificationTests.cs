using FluentValidation.TestHelper;
using System.Net;
using System.Net.Sockets;
using System.Text.Json;
using System.Diagnostics;
using StackExchange.Redis;
using Npgsql;
using Parking.Parking.Application.DTOs;
using Parking.Parking.Application.Features.Bookings.Commands;
using Parking.ServiceDefaults;
using Xunit;

namespace Parking.Microservices.Tests;

public sealed partial class ParkingWorkflowTests
{
    [PostgresFact]
    [Trait("Ticket", "SCRUM-110")]
    public async Task AutoSlotSkipsAdvisoryLockedSlotWithoutTakingItsRowLock()
    {
        var alternative = await AddVerificationSlot();
        await using var connection = await data.OpenConnectionAsync();
        await using var transaction = await connection.BeginTransactionAsync();
        await using var advisory = new NpgsqlCommand(
            "SELECT lock_parking_resource('SLOT', @slot)", connection, transaction);
        advisory.Parameters.AddWithValue("slot", Slot);
        await advisory.ExecuteNonQueryAsync();

        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(5));
        var result = await repository.CheckInWalkInAsync(Staff,
            new CheckInRequestDto(Lot, Gate, null, "51B12345"), "skip-advisory", timeout.Token);

        Assert.Equal(alternative, result.SlotId);
        await using var row = new NpgsqlCommand(
            "SELECT id FROM parking_slots WHERE id=@slot FOR UPDATE NOWAIT", connection, transaction);
        row.Parameters.AddWithValue("slot", Slot);
        Assert.Equal(Slot, await row.ExecuteScalarAsync());
    }

    [PostgresFact]
    [Trait("Ticket", "SCRUM-110")]
    public async Task AutoSlotRegistersNewVehicleAndCreatesPhysicalOccupancy()
    {
        var result = await repository.CheckInWalkInAsync(
            Staff, new CheckInRequestDto(Lot, Gate, null, "51B12345"), "walk-in", Ct);

        Assert.Equal(Slot, result.SlotId);
        Assert.Equal("WALK_IN", result.EntryMethod);
        Assert.Null(result.BookingId);
        Assert.Equal(1L, await Scalar("SELECT count(*) FROM vehicles WHERE plate_normalized='51B12345'"));
        Assert.Equal(1L, await Scalar("SELECT count(*) FROM parking_sessions WHERE status='ACTIVE'"));
        Assert.Equal(1L, await Scalar("SELECT count(*) FROM session_slot_assignments WHERE vacated_at IS NULL"));
    }

    [PostgresFact]
    [Trait("Ticket", "SCRUM-110")]
    public async Task AutoSlotSkipsLockedSlotAndSelectsAnotherSlot()
    {
        var alternative = await AddVerificationSlot();
        await using var connection = await data.OpenConnectionAsync();
        await using var transaction = await connection.BeginTransactionAsync();
        await using var lockedSlot = new NpgsqlCommand(
            "SELECT id FROM parking_slots WHERE id=@id FOR UPDATE", connection, transaction);
        lockedSlot.Parameters.AddWithValue("id", Slot);
        await lockedSlot.ExecuteScalarAsync();

        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(10));
        var result = await repository.CheckInWalkInAsync(
            Staff, new CheckInRequestDto(Lot, Gate, null, "51B12345"), "skip-locked", timeout.Token);

        Assert.Equal(alternative, result.SlotId);
    }

    [PostgresFact]
    [Trait("Ticket", "SCRUM-110")]
    public async Task AutoSlotConcurrentArrivalsCannotClaimTheSameSlot()
    {
        var arrivals = Enumerable.Range(0, 6).Select(async index =>
        {
            try
            {
                await repository.CheckInWalkInAsync(Staff,
                    new CheckInRequestDto(Lot, Gate, null, $"51B1234{index}"), $"arrival-{index}", Ct);
                return 200;
            }
            catch (ServiceException error)
            {
                return error.StatusCode;
            }
        });

        var statuses = await Task.WhenAll(arrivals);
        Assert.Equal(1, statuses.Count(status => status == 200));
        Assert.Equal(5, statuses.Count(status => status == 409));
        Assert.Equal(1L, await Scalar("SELECT count(*) FROM session_slot_assignments WHERE vacated_at IS NULL"));
    }

    [PostgresFact]
    [Trait("Ticket", "SCRUM-110")]
    public async Task AutoSlotRejectsSecondActiveSessionWhileAnotherSlotIsFree()
    {
        await AddVerificationSlot();
        var request = new CheckInRequestDto(Lot, Gate, null, "51B12345");
        await repository.CheckInWalkInAsync(Staff, request, "first-entry", Ct);

        var error = await Assert.ThrowsAsync<ServiceException>(() =>
            repository.CheckInWalkInAsync(Staff, request, "second-entry", Ct));

        Assert.Equal(409, error.StatusCode);
        Assert.Contains("active parking session", error.Message);
        Assert.Equal(1L, await Scalar("SELECT count(*) FROM parking_sessions"));
    }

    [PostgresFact]
    [Trait("Ticket", "SCRUM-111")]
    public async Task PlateMismatchOverrideRecordsIncidentActorAndAudit()
    {
        var token = await ConfirmAndIssue(await Book());
        var request = Request(token) with
        {
            DetectedPlate = "51B54321",
            AllowMismatchOverride = true,
            OverrideReason = "Staff verified the physical registration document",
            Evidence = [new IncidentEvidenceDto("CAMERA_SNAPSHOT", "private/entry-camera.jpg", null)]
        };

        await Enter(token, "override", request);

        Assert.Equal(1L, await Scalar("SELECT count(*) FROM parking_issues WHERE issue_type='INCIDENT_0482_PLATE_MISMATCH' AND status='Resolved'"));
        Assert.Equal(Staff, await Scalar("SELECT reported_by FROM parking_issues WHERE issue_type='INCIDENT_0482_PLATE_MISMATCH'"));
        Assert.Equal(1L, await Scalar("SELECT count(*) FROM audit_logs WHERE action='CHECK_IN' AND (new_values->>'plateMismatchOverride')::boolean"));
        Assert.Equal("private/entry-camera.jpg", await Scalar("SELECT evidence->0->>'reference' FROM parking_issues WHERE issue_type='INCIDENT_0482_PLATE_MISMATCH'"));
    }

    [PostgresFact]
    [Trait("Ticket", "SCRUM-111")]
    public async Task PlateMismatchOverridePublishesRequiredOutboxEvent()
    {
        var token = await ConfirmAndIssue(await Book());
        var request = Request(token) with
        {
            DetectedPlate = "51B54321",
            AllowMismatchOverride = true,
            OverrideReason = "Staff verified the physical registration document",
            Evidence = [new IncidentEvidenceDto("CAMERA_SNAPSHOT", "private/entry-camera.jpg", null)]
        };
        var first = await Enter(token, "override-event", request);
        var replay = await Enter(token, "override-event", request);
        Assert.Equal(first.SessionId, replay.SessionId);
        var changedPhoto = request with { Evidence = [new IncidentEvidenceDto("CAMERA", "private/different.jpg", null)] };
        var conflict = await Assert.ThrowsAsync<ServiceException>(() => Enter(token, "override-event", changedPhoto));
        Assert.Equal(409, conflict.StatusCode);

        var eventCount = await Scalar("""
            SELECT (SELECT count(*) FROM outbox_events
                    WHERE event_type='parking.checkin.mismatch_override')
                 + (SELECT count(*) FROM integration_outbox
                    WHERE event_type='parking.checkin.mismatch_override')
            """);
        Assert.Equal(1L, eventCount);
    }

    [PostgresFact]
    [Trait("Ticket", "SCRUM-111")]
    public async Task PlateMismatchOverrideRejectsMissingPhotoWithoutConsumingQr()
    {
        var token = await ConfirmAndIssue(await Book());
        var error = await Assert.ThrowsAsync<ServiceException>(() => Enter(token, "missing-photo", Request(token) with
        {
            DetectedPlate = "51B54321",
            AllowMismatchOverride = true,
            OverrideReason = "Staff verified the physical registration document"
        }));

        Assert.Equal(400, error.StatusCode);
        Assert.Equal(0L, await Scalar("SELECT count(*) FROM parking_sessions"));
        Assert.Equal(0L, await Scalar("SELECT count(*) FROM qr_tokens WHERE consumed_at IS NOT NULL"));
    }

    [PostgresFact]
    [Trait("Ticket", "SCRUM-112")]
    public async Task IncidentConcurrentUpdatesRejectStaleVersionAndPreserveHistory()
    {
        var incident = await repository.CreateIncidentAsync(Lot, Staff,
            new CreateIncidentRequestDto("Gate issue", "GATE", "Medium", "Gate requires inspection", DateTimeOffset.UtcNow),
            "incident", Ct);

        async Task<int> Update(string status)
        {
            try
            {
                var updated = await repository.UpdateIncidentStatusAsync(Lot, incident.IncidentId, Staff,
                    new UpdateIncidentStatusRequestDto(status, "Verified update", 1), status, Ct);
                Assert.Equal(2, updated.Version);
                return 200;
            }
            catch (ServiceException error)
            {
                return error.StatusCode;
            }
        }

        var statuses = await Task.WhenAll(Update("InProgress"), Update("Escalated"));
        Assert.Single(statuses, status => status == 200);
        Assert.Single(statuses, status => status == 409);
        Assert.Equal(2, await Scalar("SELECT version FROM parking_issues"));
        Assert.Equal(1L, await Scalar("SELECT count(*) FROM incident_history WHERE action='STATUS_UPDATED'"));
    }

    [PostgresFact]
    [Trait("Ticket", "SCRUM-112")]
    public async Task IncidentStaleVersionIsRejectedWithoutWaitingForRowLock()
    {
        var incident = await repository.CreateIncidentAsync(Lot, Staff,
            new CreateIncidentRequestDto("Gate issue", "GATE", "Medium", "Gate requires inspection", DateTimeOffset.UtcNow),
            "incident", Ct);
        await repository.UpdateIncidentStatusAsync(Lot, incident.IncidentId, Staff,
            new UpdateIncidentStatusRequestDto("InProgress", null, 1), "progress", Ct);
        await using var connection = await data.OpenConnectionAsync();
        await using var transaction = await connection.BeginTransactionAsync();
        await using var rowLock = new NpgsqlCommand("SELECT id FROM parking_issues WHERE id=@id FOR UPDATE", connection, transaction);
        rowLock.Parameters.AddWithValue("id", incident.IncidentId);
        await rowLock.ExecuteScalarAsync();

        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(5));
        var error = await Assert.ThrowsAsync<ServiceException>(() => repository.UpdateIncidentStatusAsync(
            Lot, incident.IncidentId, Staff, new UpdateIncidentStatusRequestDto("Escalated", "Needs manager review", 1),
            "stale", timeout.Token));
        Assert.Equal(409, error.StatusCode);
    }

    [PostgresFact]
    [Trait("Ticket", "SCRUM-112")]
    public async Task HandoverStaleReassignmentReturns409WithoutChangingReceiver()
    {
        var handover = await repository.CreateShiftHandoverAsync(Lot, Staff, await VerificationHandover(), "handover", Ct);
        var nextReceiver = Guid.NewGuid();
        await AddVerificationShift(nextReceiver);
        var updated = await repository.ReassignReceiverAsync(Lot, handover.HandoverId, Staff,
            new ReassignReceiverRequestDto(nextReceiver, "Receiver is unavailable", 1), "reassign", Ct);

        await using var connection = await data.OpenConnectionAsync();
        await using var transaction = await connection.BeginTransactionAsync();
        await using var rowLock = new NpgsqlCommand("SELECT id FROM shift_handovers WHERE id=@id FOR UPDATE", connection, transaction);
        rowLock.Parameters.AddWithValue("id", handover.HandoverId);
        await rowLock.ExecuteScalarAsync();
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(5));

        var error = await Assert.ThrowsAsync<ServiceException>(() =>
            repository.ReassignReceiverAsync(Lot, handover.HandoverId, Staff,
                new ReassignReceiverRequestDto(Guid.NewGuid(), "Another receiver is available", 1), "stale-reassign", timeout.Token));

        Assert.Equal(2, updated.Version);
        Assert.Equal(409, error.StatusCode);
        Assert.Equal(nextReceiver, await Scalar("SELECT receiver_user_id FROM shift_handovers"));
        Assert.Equal(2, await Scalar("SELECT version FROM shift_handovers"));
    }

    [PostgresFact]
    [Trait("Ticket", "SCRUM-113")]
    public async Task HandoverConcurrentIdempotentRequestsCreateOneRecordAndRejectChangedPayload()
    {
        var request = await VerificationHandover();
        var results = await Task.WhenAll(Enumerable.Range(0, 6).Select(_ =>
            repository.CreateShiftHandoverAsync(Lot, Staff, request, "same-key", Ct)));

        Assert.Single(results.Select(result => result.HandoverId).Distinct());
        Assert.Equal(1L, await Scalar("SELECT count(*) FROM shift_handovers"));
        Assert.Equal(1L, await Scalar("SELECT count(*) FROM shift_handover_history"));
        Assert.Equal(1L, await Scalar("SELECT count(*) FROM integration_inbox WHERE event_type='CreateShiftHandover' AND length(payload_hash)=64"));

        var error = await Assert.ThrowsAsync<ServiceException>(() =>
            repository.CreateShiftHandoverAsync(Lot, Staff, request with { CompletedTasks = "Different work" }, "same-key", Ct));
        Assert.Equal(409, error.StatusCode);
    }

    [PostgresFact]
    [Trait("Ticket", "SCRUM-113")]
    public async Task WalkInConcurrentRetriesReplayOneSessionAndRejectChangedPayload()
    {
        var request = new CheckInRequestDto(Lot, Gate, null, "51B12345");
        var results = await Task.WhenAll(Enumerable.Range(0, 6).Select(_ =>
            repository.CheckInWalkInAsync(Staff, request, "same-entry", Ct)));

        Assert.Single(results.Select(result => result.SessionId).Distinct());
        Assert.Equal(1L, await Scalar("SELECT count(*) FROM parking_sessions"));
        Assert.Equal(1L, await Scalar("SELECT count(*) FROM integration_inbox WHERE event_type='CheckInWalkInRequest'"));

        var error = await Assert.ThrowsAsync<ServiceException>(() =>
            repository.CheckInWalkInAsync(Staff, request with { DetectedPlate = "51B54321" }, "same-entry", Ct));
        Assert.Equal(409, error.StatusCode);
    }

    [PostgresFact]
    [Trait("Ticket", "SCRUM-114")]
    public async Task DatabaseRejectsCrossLotHandoverHistory()
    {
        var handover = await repository.CreateShiftHandoverAsync(Lot, Staff, await VerificationHandover(), "handover", Ct);

        var error = await Assert.ThrowsAsync<PostgresException>(() => Sql("""
            INSERT INTO shift_handover_history(handover_id,lot_id,action,performed_by_user_id)
            VALUES(@handover,'22222222-2222-4222-8222-222222222222','TEST',@actor)
            """, ("handover", handover.HandoverId), ("actor", Staff)));

        Assert.Equal(PostgresErrorCodes.ForeignKeyViolation, error.SqlState);
        Assert.Equal(1L, await Scalar("SELECT count(*) FROM shift_handover_history"));
    }

    [PostgresFact]
    [Trait("Ticket", "SCRUM-114")]
    public async Task DatabaseRejectsSelfHandoverEvenWhenApplicationValidationIsBypassed()
    {
        await repository.CreateShiftHandoverAsync(Lot, Staff, await VerificationHandover(), "handover", Ct);

        var error = await Assert.ThrowsAsync<PostgresException>(() =>
            Sql("UPDATE shift_handovers SET receiver_user_id=sender_user_id"));

        Assert.Equal(PostgresErrorCodes.CheckViolation, error.SqlState);
        Assert.Equal("chk_shift_handovers_diff_users", error.ConstraintName);
    }

    [PostgresFact]
    [Trait("Ticket", "SCRUM-114")]
    public async Task HandoverMigrationAddsConstraintsToExistingTables()
    {
        // Model the handover tables created before the composite constraints were introduced.
        await Sql("""
            ALTER TABLE shift_handover_history DROP CONSTRAINT shift_handover_history_handover_id_lot_id_fkey;
            ALTER TABLE shift_handovers DROP CONSTRAINT chk_shift_handovers_diff_users;
            ALTER TABLE shift_handovers DROP CONSTRAINT shift_handovers_id_lot_id_key;
            ALTER TABLE shift_handover_history ADD CONSTRAINT legacy_handover_fk
                FOREIGN KEY(handover_id) REFERENCES shift_handovers(id);
            """);

        var migration = await File.ReadAllTextAsync(Path.Combine(FindRoot(),
            "database/services/parking/migrations/009_handover_integrity.sql"));
        await Sql(migration);
        await Sql(migration);

        var handover = await repository.CreateShiftHandoverAsync(Lot, Staff, await VerificationHandover(), "handover", Ct);
        var error = await Assert.ThrowsAsync<PostgresException>(() => Sql("""
            INSERT INTO shift_handover_history(handover_id,lot_id,action,performed_by_user_id)
            VALUES(@handover,'22222222-2222-4222-8222-222222222222','TEST',@actor)
            """, ("handover", handover.HandoverId), ("actor", Staff)));

        Assert.Equal(PostgresErrorCodes.ForeignKeyViolation, error.SqlState);
    }

    [PostgresFact]
    [Trait("Ticket", "SCRUM-80")]
    public async Task SpatialLayoutReadsLatestPublishedCoordinatesAndIsolatesLots()
    {
        await Sql("""
            INSERT INTO map_versions(id,lot_id,version_no,status,coordinate_unit,created_by)
            VALUES('aaaaaaaa-0000-4000-8000-000000000001',@lot,1,'PUBLISHED','METERS',@actor),
                  ('aaaaaaaa-0000-4000-8000-000000000002',@lot,2,'PUBLISHED','METERS',@actor),
                  ('aaaaaaaa-0000-4000-8000-000000000003',@lot,3,'DRAFT','METERS',@actor);
            INSERT INTO map_objects(lot_id,map_version_id,level_id,slot_id,object_type,x,y,z,rotation_y,size_x,size_y,size_z,metadata)
            SELECT @lot,id,'33333333-3333-4333-8333-333333333333',@slot,'PARKING_SLOT',version_no*10,2,3,0.5,2.5,0.1,5,'{}'::jsonb
            FROM map_versions WHERE lot_id=@lot;
            """, ("lot", Lot), ("actor", Staff), ("slot", Slot));

        var layout = await repository.GetLotLayout3DAsync(Lot, Ct);
        var level = Assert.Single(layout!.Levels);
        var zone = Assert.Single(level.Zones);
        var slot = Assert.Single(zone.Slots);
        Assert.Equal(Slot, slot.Id);
        Assert.Equal(new Vector3Dto(20, 2, 3), slot.Position);
        Assert.Equal(0.5m, slot.RotationY);
        Assert.Equal(new Vector3Dto(2.5m, 0.1m, 5), slot.Size);
        Assert.Null(await repository.GetLotLayout3DAsync(Guid.NewGuid(), Ct));

        var other = await repository.GetLotLayout3DAsync(Guid.Parse("22222222-2222-4222-8222-222222222222"), Ct);
        Assert.DoesNotContain(other!.Levels.SelectMany(item => item.Zones).SelectMany(item => item.Slots), item => item.Id == Slot);
    }

    [ParkingHttpFact]
    [Trait("Ticket", "SCRUM-80")]
    public async Task SpatialHttpReturnsEnvelopeCachedLayoutAnd404ForMissingLot()
    {
        var listeners = new[] { new TcpListener(IPAddress.Loopback, 0), new TcpListener(IPAddress.Loopback, 0) };
        foreach (var listener in listeners) listener.Start();
        var ports = listeners.Select(listener => ((IPEndPoint)listener.LocalEndpoint).Port).ToArray();
        foreach (var listener in listeners) listener.Stop();
        var secret = Guid.NewGuid().ToString("N") + Guid.NewGuid().ToString("N");
        var redisConnection = Environment.GetEnvironmentVariable("PARKING_TEST_REDIS_CONNECTION");
        var settings = new Dictionary<string, string>
        {
            ["ASPNETCORE_ENVIRONMENT"] = "Development",
            ["ConnectionStrings__Service"] = parkingConnection,
            ["ConnectionStrings__Redis"] = redisConnection ?? "",
            ["Redis__InstanceName"] = "verification:",
            ["Jwt__Key"] = secret,
            ["Qr__SigningKey"] = secret,
            ["Grpc__ServiceKey"] = secret
        };
        using var host = new LocalHost(Environment.GetEnvironmentVariable("PARKING_TEST_API_DLL")!, ports[0], ports[1], settings);
        await host.WaitUntilStarted();
        using var http = new HttpClient { BaseAddress = new Uri($"http://127.0.0.1:{ports[0]}") };
        using var ready = await http.GetAsync("/health/ready");
        Assert.Equal(HttpStatusCode.OK, ready.StatusCode);

        var route = $"/api/v1/parking-lots/{Lot}/layout";
        using var first = await http.GetAsync(route);
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        using var body = JsonDocument.Parse(await first.Content.ReadAsStringAsync());
        Assert.True(body.RootElement.GetProperty("isSuccess").GetBoolean());
        Assert.Equal(200, body.RootElement.GetProperty("statusCode").GetInt32());
        Assert.Equal(Lot, body.RootElement.GetProperty("result").GetProperty("lotId").GetGuid());

        await Sql("UPDATE parking_lots SET name='Changed after cache fill' WHERE id=@lot", ("lot", Lot));
        using var cached = await http.GetAsync(route);
        Assert.Equal(HttpStatusCode.OK, cached.StatusCode);
        using var cachedBody = JsonDocument.Parse(await cached.Content.ReadAsStringAsync());
        Assert.Equal(body.RootElement.GetProperty("result").GetRawText(), cachedBody.RootElement.GetProperty("result").GetRawText());

        if (!string.IsNullOrWhiteSpace(redisConnection))
        {
            using var redis = await ConnectionMultiplexer.ConnectAsync(redisConnection);
            var ttl = await redis.GetDatabase().KeyTimeToLiveAsync($"verification:lot_layout_{Lot}");
            Assert.NotNull(ttl);
            Assert.InRange(ttl.Value.TotalHours, 11.99, 12);
            for (var warmup = 0; warmup < 10; warmup++)
            {
                using var response = await http.GetAsync(route);
                Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            }
            var samples = new double[50];
            for (var index = 0; index < samples.Length; index++)
            {
                var watch = Stopwatch.StartNew();
                using var response = await http.GetAsync(route);
                watch.Stop();
                Assert.Equal(HttpStatusCode.OK, response.StatusCode);
                samples[index] = watch.Elapsed.TotalMilliseconds;
            }
            Array.Sort(samples);
            var p95 = samples[(int)Math.Ceiling(samples.Length * 0.95) - 1];
            var metrics = new { cache = "Redis", samples = samples.Length, medianMs = samples[25], p95Ms = p95, maxMs = samples[^1], ttlHours = ttl.Value.TotalHours };
            await File.WriteAllTextAsync(Path.Combine(FindRoot(), "artifacts/six-tickets/redis-layout-performance.json"),
                JsonSerializer.Serialize(metrics, new JsonSerializerOptions { WriteIndented = true }));
            Assert.True(p95 < 20, $"Cached layout HTTP p95 was {p95:F2} ms.");
        }

        using var missing = await http.GetAsync($"/api/v1/parking-lots/{Guid.NewGuid()}/layout");
        Assert.Equal(HttpStatusCode.NotFound, missing.StatusCode);
        using var missingBody = JsonDocument.Parse(await missing.Content.ReadAsStringAsync());
        Assert.False(missingBody.RootElement.GetProperty("isSuccess").GetBoolean());
        Assert.Equal(404, missingBody.RootElement.GetProperty("statusCode").GetInt32());
    }

    private async Task<Guid> AddVerificationSlot()
    {
        var slot = Guid.NewGuid();
        await Sql("""
            INSERT INTO parking_slots(id,lot_id,zone_id,level_id,code,operational_status,width_m,length_m)
            SELECT @id,lot_id,zone_id,level_id,'A02','ACTIVE',width_m,length_m FROM parking_slots WHERE id=@original;
            INSERT INTO slot_vehicle_types(slot_id,lot_id,vehicle_type) VALUES(@id,@lot,'CAR');
            """, ("id", slot), ("original", Slot), ("lot", Lot));
        return slot;
    }

    private async Task<CreateShiftHandoverRequestDto> VerificationHandover()
    {
        var receiver = Guid.NewGuid();
        return new CreateShiftHandoverRequestDto(
            await AddVerificationShift(Staff), await AddVerificationShift(receiver), receiver,
            "Completed vehicle checks", "No unresolved issues", "No pending transactions",
            "Equipment operational", "Check the entry gate next shift");
    }

    private async Task<Guid> AddVerificationShift(Guid userId)
    {
        var shiftId = Guid.NewGuid();
        await Sql("INSERT INTO staff_shifts(id,lot_id,staff_user_id) VALUES(@id,@lot,@user)",
            ("id", shiftId), ("lot", Lot), ("user", userId));
        return shiftId;
    }
}

public sealed class Sprint4TicketValidatorVerificationTests
{
    [Theory]
    [InlineData(null)]
    [InlineData("data:image/jpeg;base64,abcd")]
    [Trait("Ticket", "SCRUM-111")]
    public void PlateMismatchOverrideRequiresSafeCameraEvidence(string? reference)
    {
        var evidence = reference is null ? null : new[] { new IncidentEvidenceDto("CAMERA", reference, null) };
        var request = new CheckInRequestDto(Guid.NewGuid(), Guid.NewGuid(), "qr", "51A12345",
            AllowMismatchOverride: true, OverrideReason: "Staff verified vehicle documents", Evidence: evidence);
        var result = new CheckInCommandValidator().TestValidate(new CheckInCommand(Guid.NewGuid(), request, "key"));
        result.ShouldHaveValidationErrorFor(command => command.Request.Evidence);
    }

    [Theory]
    [InlineData("x")]
    [InlineData("123456789")]
    [InlineData("   123456789   ")]
    [Trait("Ticket", "SCRUM-111")]
    public void PlateMismatchOverrideRejectsReasonsShorterThanTenMeaningfulCharacters(string reason)
    {
        var request = new CheckInRequestDto(Guid.NewGuid(), Guid.NewGuid(), "qr", "51A12345",
            AllowMismatchOverride: true, OverrideReason: reason);
        var result = new CheckInCommandValidator().TestValidate(
            new CheckInCommand(Guid.NewGuid(), request, "override-key"));

        result.ShouldHaveValidationErrorFor(command => command.Request.OverrideReason);
    }
}
