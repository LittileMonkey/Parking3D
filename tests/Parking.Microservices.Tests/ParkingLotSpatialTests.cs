using FluentValidation.TestHelper;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging.Abstractions;
using Parking.Parking.Application;
using Parking.Parking.Application.DTOs;
using Parking.Parking.Application.Exceptions;
using Parking.Parking.Application.Features.ParkingLots.Queries;
using Parking.Parking.Application.Interfaces;
using Parking.Parking.Domain;
using Parking.Parking.Infrastructure.Cache;
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

    [Fact]
    public async Task ParkingCacheService_ShouldCacheValue_AndAvoidSecondDbCall()
    {
        using var memoryCache = new MemoryCache(new MemoryCacheOptions());
        var cacheService = new ParkingCacheService(memoryCache, NullLogger<ParkingCacheService>.Instance);

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

        // Lần 2: Cache Hit -> Lấy từ RAM, KHÔNG gọi lại DB
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

        using var memoryCache = new MemoryCache(new MemoryCacheOptions());
        var cacheService = new ParkingCacheService(memoryCache, NullLogger<ParkingCacheService>.Instance);

        var handler = new GetLotLayout3DQueryHandler(stubRepo, cacheService);

        var result = await handler.Handle(new GetLotLayout3DQuery(lotId), CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal(lotId, result.LotId);
        Assert.Equal("LOT-01", result.Code);
    }

    // ==========================================
    // FAKE STUB REPOSITORY FOR UNIT TESTS
    // ==========================================

    private sealed class FakeSpatialRepository(ParkingLotDetailDto? lotDetail, LotLayout3DDto? layout) : IParkingRepository
    {
        public Task<ParkingLotDetailDto?> GetParkingLotDetailAsync(Guid lotId, CancellationToken ct) => Task.FromResult(lotDetail);
        public Task<LotLayout3DDto?> GetLotLayout3DAsync(Guid lotId, CancellationToken ct) => Task.FromResult(layout);

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
}
