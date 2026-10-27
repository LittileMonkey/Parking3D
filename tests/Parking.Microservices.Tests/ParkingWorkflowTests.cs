using Grpc.Core;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Npgsql;
using Parking.Contracts.Payments.V1;
using Parking.Identity.Persistence.DataAccessLayer;
using Parking.Identity.Persistence.Repositories;
using Parking.Parking.Application;
using Parking.Parking.Application.DTOs;
using Parking.Parking.Application.Features.Bookings.Commands;
using Parking.Parking.Application.Interfaces;
using Parking.Parking.Infrastructure;
using Parking.Parking.Infrastructure.Services;
using Parking.Parking.Persistence.Repositories;
using Parking.ServiceDefaults;
using Xunit;

namespace Parking.Microservices.Tests;

public sealed class PostgresFactAttribute : FactAttribute
{
    public PostgresFactAttribute()
    {
        if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("PARKING_TEST_ADMIN_CONNECTION")))
            Skip = "Set PARKING_TEST_ADMIN_CONNECTION to a local PostgreSQL login with CREATEDB; uses isolated temporary databases.";
    }
}

// Every test creates its own databases; never clears or rewrites the user's Development data.
public sealed partial class ParkingWorkflowTests : IAsyncLifetime
{
    private readonly string parkingName = "scrum49_it_" + Guid.NewGuid().ToString("N");
    private readonly string identityName = "scrum49_it_" + Guid.NewGuid().ToString("N");
    private string adminConnection = string.Empty;
    private string identityConnection = string.Empty;
    private string parkingConnection = string.Empty;
    private NpgsqlDataSource data = null!;
    private ParkingRepository repository = null!;
    private readonly QrTokenService qr = new(new ConfigurationBuilder().AddInMemoryCollection(
        new Dictionary<string, string?> { ["Qr:SigningKey"] = new string('q', 64) }).Build(), TimeProvider.System);
    private static readonly Guid Customer = Guid.Parse("12345678-1234-4234-8234-123456789001");
    private static readonly Guid Staff = Guid.Parse("12345678-1234-4234-8234-123456789002");
    private static readonly Guid Lot = Guid.Parse("11111111-1111-4111-8111-111111111111");
    private static readonly Guid Slot = Guid.Parse("77777777-7777-4777-8777-777777777777");
    private static readonly Guid Vehicle = Guid.Parse("99999999-9999-4999-8999-999999999999");
    private static readonly Guid Gate = Guid.Parse("12345678-1234-4234-8234-123456789003");
    private static readonly CancellationToken Ct = CancellationToken.None;

    public async Task InitializeAsync()
    {
        var supplied = Environment.GetEnvironmentVariable("PARKING_TEST_ADMIN_CONNECTION");
        if (string.IsNullOrWhiteSpace(supplied)) return;
        var builder = new NpgsqlConnectionStringBuilder(supplied) { Database = "postgres", Pooling = false };
        if (builder.Host is not ("localhost" or "127.0.0.1" or "::1"))
            throw new InvalidOperationException("Integration tests only create databases on localhost.");
        adminConnection = builder.ConnectionString;
        await using var admin = new NpgsqlConnection(adminConnection);
        await admin.OpenAsync();
        foreach (var name in new[] { parkingName, identityName })
            await new NpgsqlCommand($"CREATE DATABASE \"{name}\"", admin).ExecuteNonQueryAsync();
        builder.Database = parkingName;
        builder.Pooling = true;
        parkingConnection = builder.ConnectionString;
        data = NpgsqlDataSource.Create(parkingConnection);
        builder.Database = identityName;
        identityConnection = builder.ConnectionString;
        var root = FindRoot();
        await Sql(await File.ReadAllTextAsync(Path.Combine(root, "database/services/parking/001_schema.sql")));
        var fixture = await File.ReadAllTextAsync(Path.Combine(root, "database/services/parking/002_demo_fixture.sql"));
        fixture = fixture.Replace(":'customer_id'::uuid", $"'{Customer}'::uuid")
            .Replace(":'admin_id'::uuid", $"'{Staff}'::uuid");
        await Sql(fixture);
        await Sql("INSERT INTO lot_gates(id,lot_id,code,gate_kind) VALUES(@id,@lot,'ENTRY-TEST','ENTRY')", ("id", Gate), ("lot", Lot));
        await using var identity = new NpgsqlConnection(identityConnection);
        await identity.OpenAsync();
        await new NpgsqlCommand(await File.ReadAllTextAsync(Path.Combine(root, "database/services/identity/001_schema.sql")), identity).ExecuteNonQueryAsync();
        await using var seed = new NpgsqlCommand("""
            INSERT INTO app_users(id,full_name,status) VALUES(@customer,'Test Customer','ACTIVE'),(@staff,'Test Staff','ACTIVE');
            INSERT INTO platform_user_roles(user_id,role_code) VALUES(@customer,'CUSTOMER'),(@staff,'PARKING_STAFF');
            INSERT INTO lot_staff_assignments(id,lot_id,user_id,role_code,valid_from)
              VALUES(gen_random_uuid(),@lot,@staff,'PARKING_STAFF',now()-interval '1 day');
            """, identity);
        seed.Parameters.AddWithValue("customer", Customer); seed.Parameters.AddWithValue("staff", Staff); seed.Parameters.AddWithValue("lot", Lot);
        await seed.ExecuteNonQueryAsync();
        repository = new ParkingRepository(data, TimeProvider.System);
    }

    public async Task DisposeAsync()
    {
        if (data is not null) await data.DisposeAsync();
        if (string.IsNullOrEmpty(adminConnection)) return;
        NpgsqlConnection.ClearAllPools();
        await using var admin = new NpgsqlConnection(adminConnection);
        await admin.OpenAsync();
        foreach (var name in new[] { parkingName, identityName })
        {
            if (!name.StartsWith("scrum49_it_", StringComparison.Ordinal)) throw new InvalidOperationException();
            await new NpgsqlCommand($"DROP DATABASE IF EXISTS \"{name}\" WITH (FORCE)", admin).ExecuteNonQueryAsync();
        }
    }

    private static string FindRoot()
    {
        var directory = new DirectoryInfo(Environment.GetEnvironmentVariable("PARKING_REPO_ROOT") ?? Directory.GetCurrentDirectory());
        while (directory is not null)
        {
            if (File.Exists(Path.Combine(directory.FullName, "database/services/parking/001_schema.sql"))) return directory.FullName;
            directory = directory.Parent;
        }
        throw new InvalidOperationException("Set PARKING_REPO_ROOT to the repository path.");
    }

    private async Task Sql(string sql, params (string Key, object Value)[] parameters)
    {
        await using var command = data.CreateCommand(sql);
        foreach (var (key, value) in parameters) command.Parameters.AddWithValue(key, value);
        await command.ExecuteNonQueryAsync();
    }

    private async Task<object?> Scalar(string sql)
    {
        await using var command = data.CreateCommand(sql);
        return await command.ExecuteScalarAsync();
    }

    private Task<BookingView> Book(int startMinutes = 2) => repository.CreateBookingAsync(Customer,
        new BookingRequest(Lot, Slot, Vehicle, DateTimeOffset.UtcNow.AddMinutes(startMinutes),
            DateTimeOffset.UtcNow.AddMinutes(startMinutes + 60)), Guid.NewGuid().ToString(), Ct);

    private async Task<GeneratedQrToken> ConfirmAndIssue(BookingView booking)
    {
        var payment = new PaymentSucceeded
        {
            EventId = Guid.NewGuid().ToString(),
            PaymentId = Guid.NewGuid().ToString(),
            BookingId = booking.Id.ToString(),
            LotId = Lot.ToString(),
            AmountMinor = booking.EstimatedAmount,
            Currency = "VND",
            PaidAtUnixSeconds = DateTimeOffset.UtcNow.ToUnixTimeSeconds()
        };
        var grpc = new PaymentEventsGrpc(data);
        Assert.Equal("CONFIRMED", (await grpc.DeliverPaymentSucceeded(payment, new CallContext())).Outcome);
        Assert.Equal("CONFIRMED", (await grpc.DeliverPaymentSucceeded(payment, new CallContext())).Outcome); // replay
        var context = (await repository.GetBookingQrContextAsync(booking.Id, Ct))!;
        var token = qr.GenerateToken(booking.Id, Lot, Vehicle, context.ArrivalDeadline);
        await repository.SaveIssuedQrTokenAsync(booking.Id, Lot, Vehicle, token, Ct);
        return token;
    }

    private CheckInRequestDto Request(GeneratedQrToken token) => new(Lot, Gate, token.QrPayload, "51a-123.45");
    private Task<CheckInResponseDto> Enter(GeneratedQrToken token, string? key = null, CheckInRequestDto? request = null)
    {
        Assert.True(qr.TryValidateAndExtract(token.QrPayload, out var validated));
        return repository.CheckInAsync(Staff, request ?? Request(token), validated!, key ?? Guid.NewGuid().ToString(), Ct);
    }

    [PostgresFact]
    public async Task ConfirmedQrCreatesOneSessionAndOccupancyThenRetryIsSafe()
    {
        var booking = await Book();
        Assert.InRange((booking.HoldExpiresAt - DateTimeOffset.UtcNow).TotalMinutes, 4.8, 5.1);
        var token = await ConfirmAndIssue(booking);
        var held = await repository.GetLotAvailabilityAsync(Lot, null, null, "CAR", null, Ct);
        Assert.Equal(1, held.HeldCount); Assert.Equal(0, held.OccupiedCount);
        var first = await Enter(token, "same-request");
        Assert.Equal(first, await Enter(token, "same-request"));
        await Assert.ThrowsAsync<ServiceException>(() => Enter(token, "another-request"));
        Assert.Equal(1L, await Scalar("SELECT count(*) FROM parking_sessions"));
        Assert.Equal(1L, await Scalar("SELECT count(*) FROM session_slot_assignments WHERE vacated_at IS NULL"));
        Assert.Equal(1L, await Scalar("SELECT count(*) FROM qr_tokens WHERE consumed_at IS NOT NULL"));
        Assert.Equal(1L, await Scalar("SELECT count(*) FROM audit_logs WHERE action='CHECK_IN'"));
        Assert.Equal("CHECKED_IN", (await repository.GetBookingDetailAsync(booking.Id, Ct))!.Value.Detail.Status);
        Assert.Equal(3, await Scalar("SELECT version FROM bookings"));
        var occupied = await repository.GetLotAvailabilityAsync(Lot, null, null, "CAR", null, Ct);
        Assert.Equal(1, occupied.OccupiedCount); Assert.Equal(0, occupied.AvailableCount);
        Assert.Equal(0, await repository.ExpireHoldsAsync(Ct));
        Assert.Equal(1L, await Scalar("SELECT count(*) FROM session_slot_assignments WHERE vacated_at IS NULL"));
    }

    [PostgresFact]
    public async Task ConcurrentScansHaveExactlyOneEffect()
    {
        var token = await ConfirmAndIssue(await Book());
        async Task<bool> Scan()
        {
            try { await Enter(token); return true; }
            catch (ServiceException exception) when (exception.StatusCode == 409) { return false; }
        }
        var results = await Task.WhenAll(Enumerable.Range(0, 10).Select(_ => Scan()));
        Assert.Equal(1, results.Count(result => result));
        Assert.Equal(1L, await Scalar("SELECT count(*) FROM parking_sessions"));
    }

    [PostgresFact]
    public async Task ReissueRevokesOldQrAndWrongPlateOrGateDoesNotConsumeNewQr()
    {
        var booking = await Book(); var old = await ConfirmAndIssue(booking);
        var context = (await repository.GetBookingQrContextAsync(booking.Id, Ct))!;
        var current = qr.GenerateToken(booking.Id, Lot, Vehicle, context.ArrivalDeadline);
        await repository.SaveIssuedQrTokenAsync(booking.Id, Lot, Vehicle, current, Ct);
        await Assert.ThrowsAsync<ServiceException>(() => Enter(old));
        await Assert.ThrowsAsync<ServiceException>(() => Enter(current, request: Request(current) with { DetectedPlate = "51A00000" }));
        await Assert.ThrowsAsync<ServiceException>(() => Enter(current, request: Request(current) with { GateId = Guid.NewGuid() }));
        Assert.Equal(0L, await Scalar("SELECT count(*) FROM qr_tokens WHERE consumed_at IS NOT NULL"));
        await Enter(current);
    }

    [PostgresFact]
    public async Task PendingBookingCannotIssueQrAndHoldExpiryReleasesOnlyReservation()
    {
        var booking = await Book(); var context = (await repository.GetBookingQrContextAsync(booking.Id, Ct))!;
        var token = qr.GenerateToken(booking.Id, Lot, Vehicle, context.ArrivalDeadline);
        await Assert.ThrowsAsync<ServiceException>(() => repository.SaveIssuedQrTokenAsync(booking.Id, Lot, Vehicle, token, Ct));
        await Sql("UPDATE bookings SET hold_expires_at=now()-interval '1 minute'");
        Assert.Equal(1, await repository.ExpireHoldsAsync(Ct));
        Assert.Equal("EXPIRED", (await repository.GetBookingDetailAsync(booking.Id, Ct))!.Value.Detail.Status);
        Assert.Equal(1L, await Scalar("SELECT count(*) FROM slot_reservations WHERE status='RELEASED'"));
        Assert.Equal(1, (await repository.GetLotAvailabilityAsync(Lot, null, null, "CAR", null, Ct)).AvailableCount);
        Assert.Equal(0, await repository.ExpireHoldsAsync(Ct));
    }

    [PostgresFact]
    public async Task TooEarlyIsRejectedWithoutConsumingQr()
    {
        var token = await ConfirmAndIssue(await Book(120));
        await Assert.ThrowsAsync<ServiceException>(() => Enter(token));
        Assert.Equal(0L, await Scalar("SELECT count(*) FROM qr_tokens WHERE consumed_at IS NOT NULL"));
    }

    [PostgresFact]
    public async Task MaintenanceBlocksOtherwiseValidCheckIn()
    {
        var token = await ConfirmAndIssue(await Book());
        await Sql("UPDATE parking_slots SET operational_status='MAINTENANCE' WHERE id=@slot", ("slot", Slot));
        await Assert.ThrowsAsync<ServiceException>(() => Enter(token));
        Assert.Equal(0L, await Scalar("SELECT count(*) FROM qr_tokens WHERE consumed_at IS NOT NULL"));
        await Sql("UPDATE parking_slots SET operational_status='ACTIVE' WHERE id=@slot", ("slot", Slot));
        await Enter(token);
    }

    [PostgresFact]
    public async Task ArrivalDeadlineBlocksOtherwiseValidSignedQr()
    {
        var token = await ConfirmAndIssue(await Book());
        await Sql("UPDATE bookings SET arrival_deadline=now()-interval '1 second'");
        await Assert.ThrowsAsync<ServiceException>(() => Enter(token));
        Assert.Equal(0L, await Scalar("SELECT count(*) FROM qr_tokens WHERE consumed_at IS NOT NULL"));
    }

    [PostgresFact]
    public async Task DatabaseExpiryAndArrivalDeadlineAreRechecked()
    {
        var token = await ConfirmAndIssue(await Book());
        await Sql("UPDATE qr_tokens SET created_at=now()-interval '2 hours',expires_at=now()-interval '1 hour'");
        await Assert.ThrowsAsync<ServiceException>(() => Enter(token));
        await Sql("UPDATE bookings SET arrival_deadline=now()-interval '1 second'");
        await Assert.ThrowsAsync<ServiceException>(() => Enter(token));
        Assert.Equal(0L, await Scalar("SELECT count(*) FROM parking_sessions"));
    }

    [PostgresFact]
    public async Task FailureAfterConsumeRollsBackAllBusinessWrites()
    {
        var token = await ConfirmAndIssue(await Book());
        await Sql("""
            CREATE FUNCTION fail_check_in_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
              IF NEW.action='CHECK_IN' THEN RAISE EXCEPTION 'Injected test failure'; END IF; RETURN NEW; END $$;
            CREATE TRIGGER fail_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION fail_check_in_audit();
            """);
        await Assert.ThrowsAsync<PostgresException>(() => Enter(token, "retry-after-rollback"));
        Assert.Equal(0L, await Scalar("SELECT count(*) FROM qr_tokens WHERE consumed_at IS NOT NULL"));
        Assert.Equal(0L, await Scalar("SELECT count(*) FROM parking_sessions"));
        Assert.Equal("CONFIRMED", await Scalar("SELECT status::text FROM bookings"));
        await Sql("DROP TRIGGER fail_audit ON audit_logs");
        await Enter(token, "retry-after-rollback");
    }

    [PostgresFact]
    [Trait("Dependency", "IdentityIntegration")]
    public async Task StaffScopeCustomerDeniedAndRevokedAssignmentAreCheckedAgainstIdentityDatabase()
    {
        await using var context = new ParkingDatabaseV4Context(new DbContextOptionsBuilder<ParkingDatabaseV4Context>().UseNpgsql(identityConnection).Options);
        var access = new AssignedLotRepository(context);
        Assert.True(await access.CheckAccessAsync(Staff, Lot, "LOOKUP", Ct));
        Assert.True(await access.CheckAccessAsync(Staff, Lot, "CHECK_IN", Ct));
        Assert.False(await access.CheckAccessAsync(Customer, Lot, "CHECK_IN", Ct));
        Assert.False(await access.CheckAccessAsync(Staff, Guid.NewGuid(), "CHECK_IN", Ct));
        await context.Database.ExecuteSqlRawAsync("UPDATE lot_staff_assignments SET revoked_at=now()");
        Assert.False(await access.CheckAccessAsync(Staff, Lot, "CHECK_IN", Ct));
    }

    [PostgresFact]
    public async Task HoldExpiryNeverReleasesPhysicalOccupancyEvenForAnotherExpiredHold()
    {
        var first = await Book();
        var anotherVehicle = Guid.NewGuid();
        await Sql("""
            INSERT INTO vehicles(id,plate_country,plate_normalized,vehicle_type,fuel_type,is_active)
              VALUES(@vehicle,'VN','51A54321','CAR','PETROL',true);
            INSERT INTO user_vehicle_access(user_id,vehicle_id,access_kind,verified_at,is_primary)
              VALUES(@customer,@vehicle,'OWNER',now(),true);
            """, ("vehicle", anotherVehicle), ("customer", Customer));
        var second = await repository.CreateBookingAsync(Customer,
            new BookingRequest(Lot, Slot, anotherVehicle, DateTimeOffset.UtcNow.AddHours(3), DateTimeOffset.UtcNow.AddHours(4)), "second", Ct);
        var token = await ConfirmAndIssue(first);
        await Enter(token);
        await Sql("UPDATE bookings SET hold_expires_at=now()-interval '1 minute' WHERE id=@id", ("id", second.Id));
        Assert.Equal(0, await repository.ExpireHoldsAsync(Ct));
        Assert.Equal("PENDING_PAYMENT", (await repository.GetBookingDetailAsync(second.Id, Ct))!.Value.Detail.Status);
        Assert.Equal(1L, await Scalar("SELECT count(*) FROM session_slot_assignments WHERE vacated_at IS NULL"));
        Assert.Equal(1, (await repository.GetLotAvailabilityAsync(Lot, null, null, "CAR", null, Ct)).OccupiedCount);
    }

    [PostgresFact]
    public async Task AvailabilityValidatesRangeLevelVehicleTypeClosureAndOverlappingBookings()
    {
        var availability = await repository.GetLotAvailabilityAsync(Lot, null, null, "car", null, Ct);
        Assert.Equal(1, availability.AvailableCount);
        await Assert.ThrowsAsync<ServiceException>(() => repository.GetLotAvailabilityAsync(Lot, DateTimeOffset.UtcNow, DateTimeOffset.UtcNow.AddHours(-1), null, null, Ct));
        await Assert.ThrowsAsync<ServiceException>(() => repository.GetLotAvailabilityAsync(Lot, null, null, "TRUCK", null, Ct));
        await Assert.ThrowsAsync<global::Parking.Parking.Application.Exceptions.NotFoundException>(() =>
            repository.GetLotAvailabilityAsync(Lot, null, null, "CAR", Guid.NewGuid(), Ct));
        await Book();
        await Assert.ThrowsAsync<PostgresException>(() => Book()); // real GiST overlap guard
        await Sql("INSERT INTO lot_closures(id,lot_id,starts_at,ends_at,reason) VALUES(gen_random_uuid(),@lot,now()-interval '1 hour',now()+interval '1 hour','Test closure')", ("lot", Lot));
        await Assert.ThrowsAsync<ServiceException>(() => repository.GetLotAvailabilityAsync(Lot, null, null, "CAR", null, Ct));
    }

    [PostgresFact]
    public async Task ReplayKeyCannotBeReusedForAnotherBodyAndExitGateCannotAdmit()
    {
        var token = await ConfirmAndIssue(await Book());
        await Sql("UPDATE lot_gates SET gate_kind='EXIT' WHERE id=@gate", ("gate", Gate));
        await Assert.ThrowsAsync<ServiceException>(() => Enter(token));
        await Sql("UPDATE lot_gates SET gate_kind='ENTRY' WHERE id=@gate", ("gate", Gate));
        await Enter(token, "fingerprint");
        await Assert.ThrowsAsync<ServiceException>(() => Enter(token, "fingerprint", Request(token) with { DetectedPlate = "OTHER" }));
        Assert.Equal(1L, await Scalar("SELECT count(*) FROM parking_sessions"));
    }

    private sealed class CallContext : ServerCallContext
    {
        protected override string MethodCore => "test";
        protected override string HostCore => "localhost";
        protected override string PeerCore => "localhost";
        protected override DateTime DeadlineCore => DateTime.UtcNow.AddMinutes(1);
        protected override Metadata RequestHeadersCore => new();
        protected override CancellationToken CancellationTokenCore => Ct;
        protected override Metadata ResponseTrailersCore { get; } = new();
        protected override Status StatusCore { get; set; }
        protected override WriteOptions? WriteOptionsCore { get; set; }
        protected override AuthContext AuthContextCore => new("test", new Dictionary<string, List<AuthProperty>>());
        protected override ContextPropagationToken CreatePropagationTokenCore(ContextPropagationOptions? options) => throw new NotSupportedException();
        protected override Task WriteResponseHeadersAsyncCore(Metadata responseHeaders) => Task.CompletedTask;
    }
}
