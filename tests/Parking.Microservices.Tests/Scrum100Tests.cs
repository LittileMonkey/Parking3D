using Grpc.Net.Client;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Npgsql;
using Parking.Contracts.AI.V1;
using Parking.Parking.Domain;
using Parking.Parking.Infrastructure;
using Parking.Parking.Infrastructure.Repositories;
using Parking.Parking.Persistence.Repositories;
using Xunit;

namespace Parking.Microservices.Tests;

public sealed class Scrum100Tests
{
    [Theory]
    [InlineData(0, 0)]
    [InlineData(1, 0)]
    [InlineData(7, 0)]
    [InlineData(9, 0)]
    [InlineData(17, 10)]
    [InlineData(1234567, 1234560)]
    public void CalculateHoldDeadline_TruncatesSubMicrosecondTicksToPostgresPrecision(long inputTicks, long expectedTicks)
    {
        var baseUtc = new DateTimeOffset(2026, 11, 12, 5, 0, 0, TimeSpan.Zero);
        var input = baseUtc.AddTicks(inputTicks);

        var deadline = ParkingRepository.CalculateHoldDeadline(input, 5);

        Assert.Equal(TimeSpan.Zero, deadline.Offset);
        Assert.Equal(0, deadline.UtcTicks % TimeSpan.TicksPerMicrosecond);
        Assert.Equal(baseUtc.AddMinutes(5).AddTicks(expectedTicks), deadline);
    }

    [Fact]
    public void CalculateHoldDeadline_NormalizesNonUtcOffsetsWithoutRoundingUpMicroseconds()
    {
        var offsetPlusSeven = new DateTimeOffset(2026, 11, 12, 12, 0, 0, TimeSpan.FromHours(7)).AddTicks(29);

        var deadline = ParkingRepository.CalculateHoldDeadline(offsetPlusSeven, 5);

        Assert.Equal(TimeSpan.Zero, deadline.Offset);
        Assert.Equal(new DateTimeOffset(2026, 11, 12, 5, 5, 0, TimeSpan.Zero).AddTicks(20), deadline);
    }

    [Theory]
    [InlineData("PENDING_PAYMENT", false, 50000, 50000, true, "CONFIRMED")]
    [InlineData("PENDING_PAYMENT", false, 20000, 50000, true, "PARTIAL_PAYMENT")]
    [InlineData("PENDING_PAYMENT", false, 70000, 50000, true, "OVERPAYMENT_RECONCILIATION")]
    [InlineData("PENDING_PAYMENT", true, 50000, 50000, true, "LATE_PAYMENT_RECONCILIATION")]
    [InlineData("PENDING_PAYMENT", false, 50000, 50000, false, "LATE_PAYMENT_RECONCILIATION")]
    [InlineData("EXPIRED", true, 50000, 50000, false, "RECONCILIATION_REQUIRED")]
    [InlineData("CONFIRMED", false, 50000, 50000, true, "RECONCILIATION_REQUIRED")]
    public void PaymentDecision_EnforcesHoldBoundaryAndReservationAvailability(
        string state,
        bool holdExpired,
        long paid,
        long quote,
        bool reservationAvailable,
        string expected)
    {
        var decision = PaymentDecision.ForBooking(state, holdExpired, paid, quote, reservationAvailable);

        Assert.Equal(expected, decision);
    }

    [Fact]
    public void RepositoriesAndOccupancyWorker_AcceptOptionalTimeProviderThroughConstructorsAndDi()
    {
        using var db = NpgsqlDataSource.Create("Host=localhost;Port=5432;Database=parking_test;Username=postgres;Password=postgres");
        using var channel = GrpcChannel.ForAddress("http://localhost:5000");
        var client = new OccupancyIngestion.OccupancyIngestionClient(channel);
        var config = new ConfigurationBuilder().Build();
        var fakeClock = new FixedTimeProvider(new DateTimeOffset(2026, 11, 12, 5, 0, 0, TimeSpan.Zero));

        // Legacy signatures (without explicit TimeProvider) remain valid.
        var legacyLotRepo = new ParkingLotRepository(db);
        var legacyWorker = new OccupancyWorker(db, client, config, NullLogger<OccupancyWorker>.Instance);
        Assert.NotNull(legacyLotRepo);
        Assert.NotNull(legacyWorker);

        // DI resolves optional TimeProvider automatically when registered.
        var services = new ServiceCollection();
        services.AddSingleton(db);
        services.AddSingleton(client);
        services.AddSingleton<IConfiguration>(config);
        services.AddLogging();
        services.AddSingleton<TimeProvider>(fakeClock);
        services.AddTransient<ParkingLotRepository>();
        services.AddTransient<OccupancyWorker>();

        using var provider = services.BuildServiceProvider();
        Assert.NotNull(provider.GetRequiredService<ParkingLotRepository>());
        Assert.NotNull(provider.GetRequiredService<OccupancyWorker>());
    }

    private sealed class FixedTimeProvider(DateTimeOffset utcNow) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => utcNow;
    }
}
