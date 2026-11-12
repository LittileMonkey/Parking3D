using FluentValidation.TestHelper;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Parking.Parking.Application;
using Parking.Parking.Application.DTOs;
using Parking.Parking.Application.Exceptions;
using Parking.Parking.Application.Features.ParkingLots.Queries;
using Parking.Parking.Application.Interfaces;
using Parking.Parking.Domain;
using Parking.Parking.Domain.Entities;
using Parking.Parking.Infrastructure.Cache;
using Parking.Parking.Infrastructure.Services;
using Xunit;

namespace Parking.Microservices.Tests;

/// <summary>
/// Unit Tests cho SCRUM-80: Refactor Multi-Parking Core APIs (ParkingLot, Level, Zone, Slot & 3D Layout with Cache)
/// </summary>
public class ParkingLotSpatialTests
{
    private readonly GetParkingLotDetailQueryValidator _detailValidator = new();
    private readonly GetLotLayout3DQueryValidator _layoutValidator = new();

    // ==========================================
    // 1. VALIDATION TESTS
    // ==========================================

    [Fact]
    public void GetParkingLotDetailQueryValidator_ShouldPass_WhenLotIdValid()
    {
        var query = new GetParkingLotDetailQuery(Guid.NewGuid());
        var result = _detailValidator.TestValidate(query);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void GetParkingLotDetailQueryValidator_ShouldFail_WhenLotIdEmpty()
    {
        var query = new GetParkingLotDetailQuery(Guid.Empty);
        var result = _detailValidator.TestValidate(query);
        result.ShouldHaveValidationErrorFor(x => x.LotId);
    }

    [Fact]
    public void GetLotLayout3DQueryValidator_ShouldPass_WhenLotIdValid()
    {
        var query = new GetLotLayout3DQuery(Guid.NewGuid());
        var result = _layoutValidator.TestValidate(query);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void GetLotLayout3DQueryValidator_ShouldFail_WhenLotIdEmpty()
    {
        var query = new GetLotLayout3DQuery(Guid.Empty);
        var result = _layoutValidator.TestValidate(query);
        result.ShouldHaveValidationErrorFor(x => x.LotId);
    }

    // ==========================================
    // 2. CACHE SERVICE TESTS (TTL 12H)
    // ==========================================

    private static (MemoryDistributedCache Cache, ParkingCacheService Service) CreateDistributedCacheService()
    {
        var distributedCache = new MemoryDistributedCache(Options.Create(new MemoryDistributedCacheOptions()));
        var cacheService = new ParkingCacheService(distributedCache, NullLogger<ParkingCacheService>.Instance);
        return (distributedCache, cacheService);
    }

    [Fact]
    public async Task ParkingCacheService_ShouldCacheValue_AndAvoidSecondDbCall()
    {
        var (_, cacheService) = CreateDistributedCacheService();

        var key = "test_key_01";
        var callCount = 0;

        Task<string?> Factory()
        {
            callCount++;
            return Task.FromResult<string?>("DatabaseResult");
        }

        // Lần 1: Cache Miss -> Gọi DB
        var firstResult = await cacheService.GetOrSetAsync(key, Factory, TimeSpan.FromHours(12));
        Assert.Equal("DatabaseResult", firstResult);
        Assert.Equal(1, callCount);

        // Lần 2: Cache Hit -> Lấy từ Distributed Cache, KHÔNG gọi lại DB
        var secondResult = await cacheService.GetOrSetAsync(key, Factory, TimeSpan.FromHours(12));
        Assert.Equal("DatabaseResult", secondResult);
        Assert.Equal(1, callCount); // Vẫn chỉ là 1

        // Xóa cache (Eviction)
        await cacheService.RemoveAsync(key);

        // Lần 3: Cache Miss sau khi xóa -> Gọi lại DB
        var thirdResult = await cacheService.GetOrSetAsync(key, Factory, TimeSpan.FromHours(12));
        Assert.Equal("DatabaseResult", thirdResult);
        Assert.Equal(2, callCount);
    }

    // ==========================================
    // 3. HANDLER TESTS (NOT FOUND & CACHE INTEGRATION)
    // ==========================================

    [Fact]
    public async Task GetParkingLotDetailQueryHandler_ShouldThrowNotFound_WhenLotDoesNotExist()
    {
        var stubRepo = new FakeSpatialRepository(lotDetail: null, layout: null);
        var handler = new GetParkingLotDetailQueryHandler(stubRepo);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            handler.Handle(new GetParkingLotDetailQuery(Guid.NewGuid()), CancellationToken.None));
    }

    [Fact]
    public async Task GetLotLayout3DQueryHandler_ShouldReturnCachedLayout_WhenLotExists()
    {
        var lotId = Guid.NewGuid();
        var sampleLayout = new LotLayout3DDto(lotId, "LOT-01", "Bãi xe mẫu", []);
        var stubRepo = new FakeSpatialRepository(lotDetail: null, layout: sampleLayout);

        var (_, cacheService) = CreateDistributedCacheService();
        var handler = new GetLotLayout3DQueryHandler(stubRepo, cacheService);

        var firstResult = await handler.Handle(new GetLotLayout3DQuery(lotId), CancellationToken.None);
        var secondResult = await handler.Handle(new GetLotLayout3DQuery(lotId), CancellationToken.None);

        Assert.NotNull(firstResult);
        Assert.Equal(lotId, firstResult.LotId);
        Assert.Equal("LOT-01", firstResult.Code);
        Assert.Equal(firstResult.LotId, secondResult.LotId);
        Assert.Equal(firstResult.Code, secondResult.Code);
        Assert.Equal(1, stubRepo.LayoutCallCount); // Lần 2 phải ăn cache, không gọi lại DB
    }

    [Fact]
    public async Task GetLotLayout3DQueryHandler_RoundTripsComplexLayoutThroughDistributedCache()
    {
        var lotId = Guid.NewGuid();
        var slotId = Guid.NewGuid();
        var sampleLayout = new LotLayout3DDto(
            lotId,
            "LOT-3D",
            "Bãi 3D",
            [
                new LevelSpatialDto(
                    Guid.NewGuid(),
                    "B1",
                    "Tầng Hầm 1",
                    "UNDERGROUND",
                    -3.5m,
                    1,
                    [
                        new ZoneSpatialDto(
                            Guid.NewGuid(),
                            "Z-A",
                            "Khu A",
                            [
                                new SlotSpatialDto(
                                    slotId,
                                    "A01",
                                    "AVAILABLE",
                                    2.5m,
                                    5.0m,
                                    new Vector3Dto(1.5m, 0m, 4.25m),
                                    90m,
                                    new Vector3Dto(2.5m, 0.2m, 5.0m))
                            ])
                    ])
            ]);

        var stubRepo = new FakeSpatialRepository(lotDetail: null, layout: sampleLayout);
        var (_, cacheService) = CreateDistributedCacheService();
        var handler = new GetLotLayout3DQueryHandler(stubRepo, cacheService);

        var first = await handler.Handle(new GetLotLayout3DQuery(lotId), CancellationToken.None);
        var second = await handler.Handle(new GetLotLayout3DQuery(lotId), CancellationToken.None);

        Assert.Equal(1, stubRepo.LayoutCallCount);
        Assert.Equal(slotId, second.Levels[0].Zones[0].Slots[0].Id);
        Assert.Equal(4.25m, second.Levels[0].Zones[0].Slots[0].Position!.Z);
        Assert.Equal(first.Name, second.Name);
    }

    [Fact]
    public async Task GetLotLayout3DQueryHandler_ShouldThrowNotFound_AndNotCacheNull_WhenLotMissing()
    {
        var lotId = Guid.NewGuid();
        var stubRepo = new FakeSpatialRepository(lotDetail: null, layout: null);

        var (_, cacheService) = CreateDistributedCacheService();
        var handler = new GetLotLayout3DQueryHandler(stubRepo, cacheService);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            handler.Handle(new GetLotLayout3DQuery(lotId), CancellationToken.None));
        await Assert.ThrowsAsync<NotFoundException>(() =>
            handler.Handle(new GetLotLayout3DQuery(lotId), CancellationToken.None));

        Assert.Equal(2, stubRepo.LayoutCallCount); // Không cache kết quả null
    }

    [Fact]
    public async Task ParkingCacheService_ShouldCallFactoryOnce_WhenConcurrentMissesOccur()
    {
        var (_, cacheService) = CreateDistributedCacheService();

        var callCount = 0;
        async Task<string?> SlowFactory()
        {
            Interlocked.Increment(ref callCount);
            await Task.Delay(50);
            return "LayoutData";
        }

        var tasks = Enumerable.Range(0, 10)
            .Select(_ => cacheService.GetOrSetAsync("stampede_key", SlowFactory, TimeSpan.FromHours(12)));

        var results = await Task.WhenAll(tasks);

        Assert.All(results, r => Assert.Equal("LayoutData", r));
        Assert.Equal(1, callCount);
    }

    [Fact]
    public async Task ParkingCacheService_ShouldFallbackToFactory_WhenDistributedCacheThrows()
    {
        var failingDistributedCache = new FailingDistributedCache();
        var cacheService = new ParkingCacheService(failingDistributedCache, NullLogger<ParkingCacheService>.Instance);

        var value = await cacheService.GetOrSetAsync(
            "resilient_key",
            () => Task.FromResult<string?>("DbFallbackValue"),
            TimeSpan.FromHours(12));

        Assert.Equal("DbFallbackValue", value);
    }

    [Fact]
    public async Task ParkingCacheService_ShouldEvictAndRecompute_WhenCachedJsonIsCorrupted()
    {
        var (distributedCache, cacheService) = CreateDistributedCacheService();
        await distributedCache.SetStringAsync("corrupt_key", "{invalid-json");

        var value = await cacheService.GetOrSetAsync(
            "corrupt_key",
            () => Task.FromResult<string?>("RecoveredValue"),
            TimeSpan.FromHours(12));

        Assert.Equal("RecoveredValue", value);
        Assert.Equal("\"RecoveredValue\"", await distributedCache.GetStringAsync("corrupt_key"));
    }

    [Fact]
    public void AddParkingCaching_RegistersRedisWhenConfigured_AndMemoryFallbackWhenEmpty()
    {
        var redisServices = new ServiceCollection();
        var redisConfig = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:Redis"] = "localhost:6379",
                ["Redis:InstanceName"] = "parking-test:"
            })
            .Build();
        redisServices.AddLogging();
        redisServices.AddParkingCaching(redisConfig);

        using var redisProvider = redisServices.BuildServiceProvider();
        var redisCache = redisProvider.GetRequiredService<IDistributedCache>();
        Assert.Contains("Redis", redisCache.GetType().Name, StringComparison.OrdinalIgnoreCase);

        var fallbackServices = new ServiceCollection();
        var emptyConfig = new ConfigurationBuilder().Build();
        fallbackServices.AddLogging();
        fallbackServices.AddParkingCaching(emptyConfig);

        using var fallbackProvider = fallbackServices.BuildServiceProvider();
        var fallbackCache = fallbackProvider.GetRequiredService<IDistributedCache>();
        Assert.IsType<MemoryDistributedCache>(fallbackCache);
    }

    [Fact]
    public async Task EstimatedPriceService_ShouldCachePricingRule_ViaDistributedCache_AndSkipNullRule()
    {
        var lotId = Guid.NewGuid();
        var (_, cacheService) = CreateDistributedCacheService();
        var repo = new FakeParkingLotRepository(
            ("Asia/Ho_Chi_Minh", "{\"blockMinutes\":15,\"rateVnd\":5000,\"dailyCapVnd\":120000,\"multiplier\":1.0}"));
        var priceService = new EstimatedPriceService(repo, cacheService);

        var start = new DateTime(2026, 11, 1, 8, 0, 0, DateTimeKind.Utc);
        var first = await priceService.CalculateEstimatedFeeAsync(lotId, "car", start, 30);
        var second = await priceService.CalculateEstimatedFeeAsync(lotId, "CAR", start, 30);

        Assert.Equal(10_000, first.TotalFee);
        Assert.True(first.HasPricing);
        Assert.Equal(first.TotalFee, second.TotalFee);
        Assert.Equal(1, repo.Calls);

        var emptyRepo = new FakeParkingLotRepository(null);
        var emptyPriceService = new EstimatedPriceService(emptyRepo, cacheService);
        var missingLotId = Guid.NewGuid();
        var missing1 = await emptyPriceService.CalculateEstimatedFeeAsync(missingLotId, "CAR", start, 30);
        var missing2 = await emptyPriceService.CalculateEstimatedFeeAsync(missingLotId, "CAR", start, 30);
        Assert.Equal(0, missing1.TotalFee);
        Assert.False(missing1.HasPricing);
        Assert.Equal(0, missing2.TotalFee);
        Assert.False(missing2.HasPricing);
        Assert.Equal(2, emptyRepo.Calls);

        var searchRepo = new FakeParkingLotRepository(
            null,
            [new ParkingLot { Id = missingLotId, Code = "NO-PRICE", Name = "No Price Lot", Status = "ACTIVE", AvailableSlots = 5 }]);
        var searchHandler = new SearchParkingLotsQueryHandler(searchRepo, emptyPriceService);
        var searchResult = await searchHandler.Handle(new SearchParkingLotsQuery
        {
            VehicleType = "CAR",
            ExpectedDuration = 60,
            SortBy = "CHEAPEST"
        }, CancellationToken.None);
        Assert.Empty(searchResult.Items);
    }

    // ==========================================
    // FAKE STUB REPOSITORY FOR UNIT TESTS
    // ==========================================

    private sealed class FakeSpatialRepository(ParkingLotDetailDto? lotDetail, LotLayout3DDto? layout) : IParkingRepository
    {
        public int LayoutCallCount { get; private set; }

        public Task<ParkingLotDetailDto?> GetParkingLotDetailAsync(Guid lotId, CancellationToken ct) => Task.FromResult(lotDetail);

        public Task<LotLayout3DDto?> GetLotLayout3DAsync(Guid lotId, CancellationToken ct)
        {
            LayoutCallCount++;
            return Task.FromResult(layout);
        }
        public Task<IReadOnlyList<LotView>> ListLotsAsync(CancellationToken ct) => throw new NotImplementedException();
        public Task<bool> LotExistsAsync(Guid lotId, CancellationToken ct) => throw new NotImplementedException();
        public Task<BookingView> CreateBookingAsync(Guid customerId, BookingRequest request, string key, CancellationToken ct) => throw new NotImplementedException();
        public Task<LotAvailabilityDto> GetLotAvailabilityAsync(Guid lotId, DateTimeOffset? startTime, DateTimeOffset? endTime, string? vehicleType, Guid? levelId, CancellationToken ct) => throw new NotImplementedException();
        public Task<(BookingDetailDto Detail, Guid? CustomerId, Guid LotId)?> GetBookingDetailAsync(Guid bookingId, CancellationToken ct) => throw new NotImplementedException();
        public Task<int> ExpireHoldsAsync(CancellationToken ct) => throw new NotImplementedException();
        public Task<BookingQrContextDto?> GetBookingQrContextAsync(Guid bookingId, CancellationToken ct) => throw new NotImplementedException();
        public Task SaveIssuedQrTokenAsync(Guid bookingId, Guid expectedLotId, Guid expectedVehicleId, GeneratedQrToken token, CancellationToken ct) => throw new NotImplementedException();
        public Task<CheckInResponseDto> CheckInAsync(Guid actorId, CheckInRequestDto request, ValidatedQrToken token, string key, CancellationToken ct) => throw new NotImplementedException();
        public Task<CheckInResponseDto> CheckInWalkInAsync(Guid actorId, CheckInRequestDto request, string key, CancellationToken ct) => throw new NotImplementedException();
        public Task<CheckOutQuoteResultDto> GetCheckOutQuoteAsync(Guid lotId, Guid gateId, string detectedPlate, string? qrPayload, CancellationToken ct, Guid? sessionId = null) => throw new NotImplementedException();
        public Task<ConfirmCheckOutResultDto?> GetCheckOutReplayAsync(Guid actorId, ConfirmCheckOutRequestDto request, string key, CancellationToken ct) => throw new NotImplementedException();
        public Task RecordCheckOutMismatchAsync(Guid sessionId, Guid actorId, string observedPlate, CancellationToken ct) => throw new NotImplementedException();
        public Task<AuthorizeCheckOutResultDto?> ClaimCheckOutAuthorizationAsync(Guid actorId, ConfirmCheckOutRequestDto request, string key, CancellationToken ct) => throw new NotImplementedException();
        public Task<AuthorizeCheckOutResultDto> SaveCheckOutAuthorizationAsync(Guid actorId, ConfirmCheckOutRequestDto request, string key, AuthorizeCheckOutResultDto result, CancellationToken ct) => throw new NotImplementedException();
        public Task<Guid?> GetSessionLotIdAsync(Guid sessionId, CancellationToken ct) => throw new NotImplementedException();
        public Task<ConfirmCheckOutResultDto> CompleteCheckOutAsync(Guid actorId, ConfirmCheckOutRequestDto request, string key, CancellationToken ct, CheckOutVerification? verification = null) => throw new NotImplementedException();

        public Task<IncidentDto> CreateIncidentAsync(Guid lotId, Guid actorId, CreateIncidentRequestDto request, string? key, CancellationToken ct) => throw new NotImplementedException();
        public Task<PagedResult<IncidentSummaryDto>> ListIncidentsAsync(Guid lotId, string? status, string? severity, string? query, int page, int pageSize, CancellationToken ct) => throw new NotImplementedException();
        public Task<IncidentDto?> GetIncidentByIdAsync(Guid lotId, Guid incidentId, CancellationToken ct) => throw new NotImplementedException();
        public Task<IncidentDto> UpdateIncidentStatusAsync(Guid lotId, Guid incidentId, Guid actorId, UpdateIncidentStatusRequestDto request, CancellationToken ct) => throw new NotImplementedException();
        public Task<PagedResult<IncidentHistoryItemDto>> GetIncidentHistoryAsync(Guid lotId, Guid incidentId, int page, int pageSize, CancellationToken ct) => throw new NotImplementedException();
        public Task<IncidentDto> ReopenIncidentAsync(Guid lotId, Guid incidentId, Guid actorId, ReopenIncidentRequestDto request, CancellationToken ct) => throw new NotImplementedException();
        public Task<IncidentDto> CancelIncidentAsync(Guid lotId, Guid incidentId, Guid actorId, CancelIncidentRequestDto request, CancellationToken ct) => throw new NotImplementedException();
        public Task<IncidentExitDecisionDto> CreateIncidentDecisionAsync(Guid lotId, Guid incidentId, Guid actorId, CreateIncidentDecisionRequestDto request, CancellationToken ct) => throw new NotImplementedException();

        public Task<ShiftHandoverDto> CreateShiftHandoverAsync(Guid lotId, Guid actorId, CreateShiftHandoverRequestDto request, string? key, CancellationToken ct) => throw new NotImplementedException();
        public Task<PagedResult<ShiftHandoverSummaryDto>> ListShiftHandoversAsync(Guid lotId, Guid actorId, bool isManager, string? status, int page, int pageSize, CancellationToken ct) => throw new NotImplementedException();
        public Task<ShiftHandoverDto?> GetShiftHandoverByIdAsync(Guid lotId, Guid handoverId, Guid actorId, bool isManager, CancellationToken ct) => throw new NotImplementedException();
        public Task<ShiftHandoverDto> ConfirmShiftHandoverAsync(Guid lotId, Guid handoverId, Guid actorId, ConfirmShiftHandoverRequestDto request, string? key, CancellationToken ct) => throw new NotImplementedException();
        public Task<ShiftHandoverDto> ReassignReceiverAsync(Guid lotId, Guid handoverId, Guid actorId, ReassignReceiverRequestDto request, CancellationToken ct) => throw new NotImplementedException();
    }

    private sealed class FailingDistributedCache : IDistributedCache
    {
        public byte[]? Get(string key) => throw new TimeoutException("Redis down");
        public Task<byte[]?> GetAsync(string key, CancellationToken token = default) => throw new TimeoutException("Redis down");
        public void Refresh(string key) => throw new TimeoutException("Redis down");
        public Task RefreshAsync(string key, CancellationToken token = default) => throw new TimeoutException("Redis down");
        public void Remove(string key) => throw new TimeoutException("Redis down");
        public Task RemoveAsync(string key, CancellationToken token = default) => throw new TimeoutException("Redis down");
        public void Set(string key, byte[] value, DistributedCacheEntryOptions options) => throw new TimeoutException("Redis down");
        public Task SetAsync(string key, byte[] value, DistributedCacheEntryOptions options, CancellationToken token = default) => throw new TimeoutException("Redis down");
    }

    private sealed class FakeParkingLotRepository(
        (string Timezone, string ParametersJson)? config,
        List<ParkingLot>? lots = null) : IParkingLotRepository
    {
        public int Calls { get; private set; }

        public Task<List<ParkingLot>> GetAvailableLotsAsync(string vehicleType, CancellationToken cancellationToken = default)
            => Task.FromResult(lots ?? new List<ParkingLot>());

        public Task<(string Timezone, string ParametersJson)?> GetPricingRuleConfigAsync(
            Guid lotId,
            string vehicleType,
            DateTime startTime,
            CancellationToken cancellationToken = default)
        {
            Calls++;
            return Task.FromResult(config);
        }
    }
}
