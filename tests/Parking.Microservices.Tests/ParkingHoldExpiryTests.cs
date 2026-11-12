using Grpc.Core;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Npgsql;
using Parking.Contracts.AI.V1;
using Parking.Contracts.Payments.V1;
using Parking.Parking.Application;
using Parking.Parking.Infrastructure;
using Parking.Parking.Infrastructure.Repositories;
using Parking.Parking.Persistence.Repositories;
using Parking.ServiceDefaults;
using Xunit;

namespace Parking.Microservices.Tests;

public sealed class PostgresTheoryAttribute : TheoryAttribute
{
    public PostgresTheoryAttribute()
    {
        if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("PARKING_TEST_ADMIN_CONNECTION")))
            Skip = "Set PARKING_TEST_ADMIN_CONNECTION to run against isolated local PostgreSQL databases.";
    }
}

public sealed partial class ParkingWorkflowTests
{
    [PostgresFact]
    public async Task HoldPolicyDefaultsToFiveMinutesInFreshSchema()
    {
        Assert.Equal("5", await Scalar("""
            SELECT column_default FROM information_schema.columns
            WHERE table_schema='public' AND table_name='lot_vehicle_policies' AND column_name='hold_minutes'
            """));
        await Sql("UPDATE lot_vehicle_policies SET hold_minutes=DEFAULT");
        var clock = UseHoldTestClock();
        var booking = await Book();
        Assert.Equal(clock.GetUtcNow().AddMinutes(5), booking.HoldExpiresAt);
    }

    [PostgresTheory]
    [InlineData(-1, 0)]
    [InlineData(0, 1)]
    [InlineData(1, 1)]
    public async Task HoldExpiryUsesInclusiveDeadlineAndIsIdempotent(int microsecondsFromDeadline, int expectedExpired)
    {
        var clock = UseHoldTestClock();
        var booking = await Book();
        clock.UtcNow = booking.HoldExpiresAt.AddTicks(microsecondsFromDeadline * 10L);

        Assert.Equal(expectedExpired, await repository.ExpireHoldsAsync(Ct));
        var detail = (await repository.GetBookingDetailAsync(booking.Id, Ct))!.Value.Detail;
        Assert.Equal(expectedExpired == 1 ? "EXPIRED" : "PENDING_PAYMENT", detail.Status);
        Assert.Equal(expectedExpired == 1 ? "RELEASED" : "HELD",
            await Scalar("SELECT status::text FROM slot_reservations"));
        Assert.Equal(1 + expectedExpired, await Scalar("SELECT version FROM bookings"));
        Assert.Equal((long)expectedExpired, await Scalar("SELECT count(*) FROM audit_logs WHERE action='EXPIRE_HOLD'"));

        Assert.Equal(0, await repository.ExpireHoldsAsync(Ct));
        Assert.Equal(1 + expectedExpired, await Scalar("SELECT version FROM bookings"));
        Assert.Equal((long)expectedExpired, await Scalar("SELECT count(*) FROM audit_logs WHERE action='EXPIRE_HOLD'"));
    }

    [PostgresTheory]
    [InlineData(-1, "CONFIRMED")]
    [InlineData(0, "LATE_PAYMENT_RECONCILIATION")]
    [InlineData(1, "LATE_PAYMENT_RECONCILIATION")]
    public async Task HoldPaymentUsesSameInclusiveDeadlineBeforeWorkerRuns(int microsecondsFromDeadline, string expectedOutcome)
    {
        var clock = UseHoldTestClock();
        var booking = await Book();
        clock.UtcNow = booking.HoldExpiresAt.AddTicks(microsecondsFromDeadline * 10L);
        using var services = new ServiceCollection().AddSingleton<TimeProvider>(clock).BuildServiceProvider();
        var payments = ActivatorUtilities.CreateInstance<PaymentEventsGrpc>(services, data);
        var payment = new PaymentSucceeded
        {
            EventId = Guid.NewGuid().ToString(), PaymentId = Guid.NewGuid().ToString(),
            BookingId = booking.Id.ToString(), LotId = Lot.ToString(),
            AmountMinor = booking.EstimatedAmount, Currency = "VND",
            // Payment may have happened earlier; delivery after the hold is still rechecked.
            PaidAtUnixSeconds = DateTimeOffset.UtcNow.ToUnixTimeSeconds()
        };

        Assert.Equal(expectedOutcome, (await payments.DeliverPaymentSucceeded(payment, new CallContext())).Outcome);
        Assert.Equal(expectedOutcome, (await payments.DeliverPaymentSucceeded(payment, new CallContext())).Outcome);
        Assert.Equal(expectedOutcome == "CONFIRMED" ? "CONFIRMED" : "EXPIRED",
            (await repository.GetBookingDetailAsync(booking.Id, Ct))!.Value.Detail.Status);
        Assert.Equal(expectedOutcome == "CONFIRMED" ? "CONFIRMED" : "RELEASED",
            await Scalar("SELECT status::text FROM slot_reservations"));
        Assert.Equal(2, await Scalar("SELECT version FROM bookings"));
        Assert.Equal(1L, await Scalar("SELECT count(*) FROM payment_receipts"));
        Assert.Equal(1L, await Scalar("SELECT count(*) FROM audit_logs WHERE action='PAYMENT_RECEIVED'"));
        Assert.Equal(0, await repository.ExpireHoldsAsync(Ct));
    }

    [PostgresFact]
    public async Task HoldPolicyChangeAndBookingReplayNeverExtendExistingDeadline()
    {
        var clock = UseHoldTestClock();
        var request = new BookingRequest(Lot, Slot, Vehicle,
            DateTimeOffset.UtcNow.AddMinutes(10), DateTimeOffset.UtcNow.AddMinutes(70));
        var booking = await repository.CreateBookingAsync(Customer, request, "hold-replay", Ct);
        await Sql("UPDATE lot_vehicle_policies SET hold_minutes=7 WHERE lot_id=@lot", ("lot", Lot));
        clock.UtcNow = clock.UtcNow.AddMinutes(1);
        Assert.Equal(booking, await repository.CreateBookingAsync(Customer, request, "hold-replay", Ct));
        Assert.InRange(Math.Abs(((await repository.GetBookingDetailAsync(booking.Id, Ct))!.Value.Detail.HoldExpiresAt!.Value
            - booking.HoldExpiresAt).TotalMilliseconds), 0d, 1d);

        clock.UtcNow = booking.HoldExpiresAt;
        Assert.Equal(1, await repository.ExpireHoldsAsync(Ct));
        var next = await Book(20);
        Assert.Equal(clock.UtcNow.AddMinutes(7), next.HoldExpiresAt);
    }

    [PostgresFact]
    public async Task HoldExpiryAndConcurrentRebookingKeepExactlyOneReservation()
    {
        var old = await Book();
        await Sql("UPDATE bookings SET hold_expires_at=clock_timestamp()-interval '1 second' WHERE id=@id", ("id", old.Id));
        async Task<bool> TryBook()
        {
            try { await Book(); return true; }
            catch (ServiceException exception) when (exception.StatusCode == 409) { return false; }
            catch (PostgresException exception) when (exception.SqlState == PostgresErrorCodes.ExclusionViolation) { return false; }
        }
        var outcomes = await Task.WhenAll(TryBook(), TryBook());
        Assert.Single(outcomes, success => success);
        Assert.Equal(1L, await Scalar("SELECT count(*) FROM slot_reservations WHERE status='HELD'"));
        Assert.Equal(1L, await Scalar("SELECT count(*) FROM bookings WHERE status='EXPIRED'"));
        Assert.Equal(1L, await Scalar("SELECT count(*) FROM audit_logs WHERE action='EXPIRE_HOLD'"));
    }

    [PostgresFact]
    public async Task HoldMigrationIsRepeatableAndPreservesCustomPoliciesAndExistingBookings()
    {
        await Sql("""
            ALTER TABLE lot_vehicle_policies ALTER COLUMN hold_minutes DROP DEFAULT;
            UPDATE lot_vehicle_policies SET hold_minutes=CASE WHEN lot_id=@lot THEN 15 ELSE 7 END;
            """, ("lot", Lot));
        var booking = await Book();
        var migration = await File.ReadAllTextAsync(Path.Combine(FindRoot(),
            "database/services/parking/migrations/002_hold_default_5_minutes.sql"));
        await Sql(migration);
        await Sql(migration);
        Assert.Equal(5, await Scalar("SELECT hold_minutes FROM lot_vehicle_policies WHERE vehicle_type='CAR'"));
        Assert.Equal(7, await Scalar("SELECT hold_minutes FROM lot_vehicle_policies WHERE vehicle_type='MOTORBIKE'"));
        Assert.Equal("5", await Scalar("""
            SELECT column_default FROM information_schema.columns
            WHERE table_schema='public' AND table_name='lot_vehicle_policies' AND column_name='hold_minutes'
            """));
        Assert.Equal(1L, await Scalar("SELECT count(*) FROM service_schema_versions WHERE version=2"));
        Assert.InRange(Math.Abs(((await repository.GetBookingDetailAsync(booking.Id, Ct))!.Value.Detail.HoldExpiresAt!.Value
            - booking.HoldExpiresAt).TotalMilliseconds), 0d, 1d);
    }

    [PostgresTheory]
    [InlineData(-1, true)]
    [InlineData(0, false)]
    [InlineData(1, false)]
    public async Task HoldPaymentQuoteStopsAtTheSameDeadline(int microsecondsFromDeadline, bool payable)
    {
        var clock = UseHoldTestClock();
        var booking = await Book();
        clock.UtcNow = booking.HoldExpiresAt.AddTicks(microsecondsFromDeadline * 10L);
        var query = new BookingPaymentQueryGrpc(data, new UnexpectedFacilityAccess(), clock);
        var request = new BookingQuoteRequest { BookingId = booking.Id.ToString(), UserId = Customer.ToString() };
        if (payable)
            Assert.Equal("PENDING_PAYMENT", (await query.GetQuote(request, new CallContext())).Status);
        else
            Assert.Equal(StatusCode.FailedPrecondition,
                (await Assert.ThrowsAsync<RpcException>(() => query.GetQuote(request, new CallContext()))).StatusCode);
    }

    [PostgresFact]
    public async Task HoldExpiryNeverChangesConfirmedBookingEvenAfterItsOldHoldDeadline()
    {
        var clock = UseHoldTestClock();
        var booking = await Book();
        await ConfirmAndIssue(booking);
        clock.UtcNow = booking.HoldExpiresAt.AddMinutes(1);
        Assert.Equal(0, await repository.ExpireHoldsAsync(Ct));
        Assert.Equal("CONFIRMED", (await repository.GetBookingDetailAsync(booking.Id, Ct))!.Value.Detail.Status);
        Assert.Equal("CONFIRMED", await Scalar("SELECT status::text FROM slot_reservations"));
        Assert.Equal(2, await Scalar("SELECT version FROM bookings"));
    }

    [PostgresFact]
    public async Task HoldExpiryContinuesPastSingleFailingBooking()
    {
        var clock = UseHoldTestClock();
        var slot2 = Guid.NewGuid();
        var vehicle2 = Guid.NewGuid();
        await Sql("""
            INSERT INTO parking_slots(id,lot_id,zone_id,level_id,code,operational_status,width_m,length_m)
              VALUES(@slot2,@lot,'55555555-5555-4555-8555-555555555555'::uuid,'33333333-3333-4333-8333-333333333333'::uuid,'A02','ACTIVE',2.5,5);
            INSERT INTO slot_vehicle_types(slot_id,lot_id,vehicle_type) VALUES(@slot2,@lot,'CAR');
            INSERT INTO vehicles(id,plate_country,plate_normalized,vehicle_type,fuel_type,is_active,created_at)
              VALUES(@vehicle2,'VN','51A99999','CAR','PETROL',true,now());
            INSERT INTO user_vehicle_access(user_id,vehicle_id,access_kind,verified_at,is_primary,created_at)
              VALUES(@customer,@vehicle2,'OWNER',now(),false,now());
            """, ("slot2", slot2), ("lot", Lot), ("vehicle2", vehicle2), ("customer", Customer));

        var poisonedBooking = await Book();
        clock.UtcNow = clock.UtcNow.AddSeconds(1);
        var healthyBooking = await repository.CreateBookingAsync(Customer,
            new BookingRequest(Lot, slot2, vehicle2,
                DateTimeOffset.UtcNow.AddMinutes(2), DateTimeOffset.UtcNow.AddMinutes(62)),
            Guid.NewGuid().ToString(), Ct);

        await Sql($"""
            CREATE OR REPLACE FUNCTION fail_poisoned_hold_expiry() RETURNS TRIGGER AS $$
            BEGIN
                IF NEW.status = 'EXPIRED' AND OLD.id = '{poisonedBooking.Id:D}'::uuid THEN
                    RAISE EXCEPTION 'Simulated poisoned booking row %', OLD.id;
                END IF;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
            CREATE TRIGGER trg_fail_poisoned_hold_expiry
              BEFORE UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION fail_poisoned_hold_expiry();
            """);

        clock.UtcNow = healthyBooking.HoldExpiresAt.AddMinutes(1);
        Assert.Equal(1, await repository.ExpireHoldsAsync(Ct));
        Assert.Equal("PENDING_PAYMENT", (await repository.GetBookingDetailAsync(poisonedBooking.Id, Ct))!.Value.Detail.Status);
        Assert.Equal("EXPIRED", (await repository.GetBookingDetailAsync(healthyBooking.Id, Ct))!.Value.Detail.Status);

        await Sql("DROP TRIGGER trg_fail_poisoned_hold_expiry ON bookings; DROP FUNCTION fail_poisoned_hold_expiry();");
        Assert.Equal(1, await repository.ExpireHoldsAsync(Ct));
        Assert.Equal("EXPIRED", (await repository.GetBookingDetailAsync(poisonedBooking.Id, Ct))!.Value.Detail.Status);
    }

    [PostgresFact]
    public async Task NewBookingAlignsHoldDeadlineToPostgresMicroseconds()
    {
        var baseSecond = DateTimeOffset.FromUnixTimeSeconds(DateTimeOffset.UtcNow.ToUnixTimeSeconds());
        var clock = new HoldTestClock(baseSecond.AddTicks(1234567));
        repository = new ParkingRepository(data, clock);

        var booking = await repository.CreateBookingAsync(Customer,
            new BookingRequest(Lot, Slot, Vehicle, baseSecond.AddMinutes(5), baseSecond.AddMinutes(65)),
            "sub-microsecond-hold", Ct);
        var loaded = (await repository.GetBookingDetailAsync(booking.Id, Ct))!.Value.Detail;

        Assert.Equal(0, booking.HoldExpiresAt.UtcTicks % TimeSpan.TicksPerMicrosecond);
        Assert.Equal(booking.HoldExpiresAt, loaded.HoldExpiresAt);
    }

    [PostgresFact]
    public async Task SearchAndOccupancyIgnoreExpiredPendingHoldBeforeWorkerRuns()
    {
        var clock = UseHoldTestClock();
        var booking = await repository.CreateBookingAsync(Customer,
            new BookingRequest(Lot, Slot, Vehicle, clock.UtcNow, clock.UtcNow.AddMinutes(60)),
            "search-occupancy-hold-sync", Ct);
        var lotRepo = new ParkingLotRepository(data, clock);
        var worker = new OccupancyWorker(
            data,
            new OccupancyIngestion.OccupancyIngestionClient(GrpcChannelForUnusedClient()),
            new ConfigurationBuilder().Build(),
            NullLogger<OccupancyWorker>.Instance,
            clock);

        var lotsWhileHeld = await lotRepo.GetAvailableLotsAsync("CAR", Ct);
        var snapshotsWhileHeld = await worker.CollectSnapshotsAsync(Ct);
        Assert.Equal(0, Assert.Single(lotsWhileHeld, l => l.Id == Lot).AvailableSlots);
        Assert.Equal(1, Assert.Single(snapshotsWhileHeld, s => s.LotId == Lot.ToString() && s.VehicleType == "CAR").ReservedCount);

        clock.UtcNow = booking.HoldExpiresAt;
        var lotsAtExpiry = await lotRepo.GetAvailableLotsAsync("CAR", Ct);
        var snapshotsAtExpiry = await worker.CollectSnapshotsAsync(Ct);
        Assert.Equal(1, Assert.Single(lotsAtExpiry, l => l.Id == Lot).AvailableSlots);
        var expiredSnapshot = Assert.Single(snapshotsAtExpiry, s => s.LotId == Lot.ToString() && s.VehicleType == "CAR");
        Assert.Equal(0, expiredSnapshot.ReservedCount);
        Assert.Equal(booking.HoldExpiresAt.ToUnixTimeSeconds(), expiredSnapshot.ObservedAtUnixSeconds);
    }

    private static Grpc.Net.Client.GrpcChannel GrpcChannelForUnusedClient() =>
        Grpc.Net.Client.GrpcChannel.ForAddress("http://localhost:5000");

    private sealed class UnexpectedFacilityAccess : IFacilityAccess
    {
        public Task RequireAsync(Guid userId, Guid lotId, string capability, CancellationToken ct) =>
            throw new InvalidOperationException("An owner quote should not require a Staff permission check.");
    }

    private HoldTestClock UseHoldTestClock()
    {
        // Whole seconds survive PostgreSQL's microsecond precision without rounding.
        var clock = new HoldTestClock(DateTimeOffset.FromUnixTimeSeconds(DateTimeOffset.UtcNow.ToUnixTimeSeconds()));
        repository = new ParkingRepository(data, clock);
        return clock;
    }

    private sealed class HoldTestClock(DateTimeOffset now) : TimeProvider
    {
        public DateTimeOffset UtcNow { get; set; } = now;
        public override DateTimeOffset GetUtcNow() => UtcNow;
    }
}
