using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Parking.Parking.Application;
using Parking.Parking.Application.DTOs;
using Parking.Parking.Application.Exceptions;
using Parking.Parking.Application.Features.Bookings.Queries;
using Parking.Parking.Application.Interfaces;
using Parking.Parking.Infrastructure.BackgroundServices;
using Parking.ServiceDefaults;
using Xunit;

namespace Parking.Microservices.Tests;

public sealed class Scrum48Tests
{
    [Fact]
    public async Task OwnerRequiresActiveUserCheckBeforeReadingBookingAndSkipsFacilityLookup()
    {
        var ownerId = Guid.NewGuid();
        var lotId = Guid.NewGuid();
        var bookingId = Guid.NewGuid();
        var detail = CreateDetail(bookingId, lotId);
        var repository = new StubParkingRepository { BookingResult = (detail, ownerId, lotId) };
        var access = new RecordingFacilityAccess();
        var handler = new GetBookingDetailQueryHandler(repository, access);

        var result = await handler.Handle(new GetBookingDetailQuery
        {
            BookingId = bookingId,
            RequestingUserId = ownerId
        }, CancellationToken.None);

        Assert.Equal(detail, result);
        Assert.Equal(1, repository.GetBookingDetailCalls);
        Assert.Equal([(ownerId, Guid.Empty, "USER")], access.Calls);
    }

    [Fact]
    public async Task SuspendedOrLockedUserIsRejectedBeforeQueryingBookingExistence()
    {
        var ownerId = Guid.NewGuid();
        var bookingId = Guid.NewGuid();
        var repository = new StubParkingRepository();
        var access = new RecordingFacilityAccess { ThrowOnCapability = "USER" };
        var handler = new GetBookingDetailQueryHandler(repository, access);

        var error = await Assert.ThrowsAsync<ServiceException>(() => handler.Handle(new GetBookingDetailQuery
        {
            BookingId = bookingId,
            RequestingUserId = ownerId
        }, CancellationToken.None));

        Assert.Equal(403, error.StatusCode);
        Assert.Equal(0, repository.GetBookingDetailCalls);
    }

    [Fact]
    public async Task NonOwnerChecksActiveUserThenFacilityLookupPermission()
    {
        var ownerId = Guid.NewGuid();
        var staffId = Guid.NewGuid();
        var lotId = Guid.NewGuid();
        var bookingId = Guid.NewGuid();
        var detail = CreateDetail(bookingId, lotId);
        var repository = new StubParkingRepository { BookingResult = (detail, ownerId, lotId) };
        var access = new RecordingFacilityAccess();
        var handler = new GetBookingDetailQueryHandler(repository, access);

        var result = await handler.Handle(new GetBookingDetailQuery
        {
            BookingId = bookingId,
            RequestingUserId = staffId
        }, CancellationToken.None);

        Assert.Equal(detail, result);
        Assert.Equal([(staffId, Guid.Empty, "USER"), (staffId, lotId, "LOOKUP")], access.Calls);
    }

    [Fact]
    public async Task ActiveUserReceivesNotFoundWhenBookingDoesNotExist()
    {
        var repository = new StubParkingRepository { BookingResult = null };
        var access = new RecordingFacilityAccess();
        var handler = new GetBookingDetailQueryHandler(repository, access);

        await Assert.ThrowsAsync<NotFoundException>(() => handler.Handle(new GetBookingDetailQuery
        {
            BookingId = Guid.NewGuid(),
            RequestingUserId = Guid.NewGuid()
        }, CancellationToken.None));
    }

    [Fact]
    public async Task HoldExpiryWorkerStopsAfterPartialBatch()
    {
        var repository = new StubParkingRepository([37]);
        await using var provider = BuildWorkerProvider(repository, out var scopes);
        var worker = new HoldExpiryWorker(scopes, NullLogger<HoldExpiryWorker>.Instance);

        var expired = await worker.ProcessCycleAsync(CancellationToken.None);

        Assert.Equal(37, expired);
        Assert.Equal(1, repository.ExpireHoldsCalls);
        Assert.Equal(1, scopes.CreatedCount);
    }

    [Fact]
    public async Task HoldExpiryWorkerDrainsMultipleFullBatchesAcrossSeparateScopes()
    {
        var repository = new StubParkingRepository([100, 100, 14]);
        await using var provider = BuildWorkerProvider(repository, out var scopes);
        var worker = new HoldExpiryWorker(scopes, NullLogger<HoldExpiryWorker>.Instance);

        var expired = await worker.ProcessCycleAsync(CancellationToken.None);

        Assert.Equal(214, expired);
        Assert.Equal(3, repository.ExpireHoldsCalls);
        Assert.Equal(3, scopes.CreatedCount);
    }

    [Fact]
    public async Task HoldExpiryWorkerCapsBatchesPerTickAtTwenty()
    {
        var repository = new StubParkingRepository(Enumerable.Repeat(100, 25));
        await using var provider = BuildWorkerProvider(repository, out var scopes);
        var worker = new HoldExpiryWorker(scopes, NullLogger<HoldExpiryWorker>.Instance);

        var expired = await worker.ProcessCycleAsync(CancellationToken.None);

        Assert.Equal(2000, expired);
        Assert.Equal(20, repository.ExpireHoldsCalls);
        Assert.Equal(20, scopes.CreatedCount);
    }

    private static ServiceProvider BuildWorkerProvider(StubParkingRepository repository, out CountingScopeFactory scopes)
    {
        var services = new ServiceCollection();
        services.AddSingleton<IParkingRepository>(repository);
        var provider = services.BuildServiceProvider();
        scopes = new CountingScopeFactory(provider.GetRequiredService<IServiceScopeFactory>());
        return provider;
    }

    private static BookingDetailDto CreateDetail(Guid bookingId, Guid lotId)
    {
        var now = new DateTimeOffset(2026, 10, 26, 10, 0, 0, TimeSpan.Zero);
        return new BookingDetailDto(
            bookingId,
            "BK-1001",
            lotId,
            "Demo Lot",
            Guid.NewGuid(),
            "A01",
            "51A12345",
            "CAR",
            now.AddMinutes(30),
            now.AddMinutes(90),
            now.AddMinutes(5),
            now.AddMinutes(60),
            "PENDING_PAYMENT",
            30000,
            null,
            now);
    }

    private sealed class RecordingFacilityAccess : IFacilityAccess
    {
        public List<(Guid UserId, Guid LotId, string Capability)> Calls { get; } = [];
        public string? ThrowOnCapability { get; init; }

        public Task RequireAsync(Guid userId, Guid lotId, string capability, CancellationToken ct)
        {
            Calls.Add((userId, lotId, capability));
            if (ThrowOnCapability == capability)
            {
                throw new ServiceException(403, "Forbidden");
            }

            return Task.CompletedTask;
        }
    }

    private sealed class CountingScopeFactory(IServiceScopeFactory inner) : IServiceScopeFactory
    {
        public int CreatedCount { get; private set; }

        public IServiceScope CreateScope()
        {
            CreatedCount++;
            return inner.CreateScope();
        }
    }

    private sealed class StubParkingRepository : IParkingRepository
    {
        private readonly Queue<int> expireBatches;

        public StubParkingRepository(IEnumerable<int>? expireBatches = null)
        {
            this.expireBatches = new Queue<int>(expireBatches ?? []);
        }

        public (BookingDetailDto Detail, Guid? CustomerId, Guid LotId)? BookingResult { get; init; }
        public int GetBookingDetailCalls { get; private set; }
        public int ExpireHoldsCalls { get; private set; }

        public Task<(BookingDetailDto Detail, Guid? CustomerId, Guid LotId)?> GetBookingDetailAsync(Guid bookingId, CancellationToken ct)
        {
            GetBookingDetailCalls++;
            return Task.FromResult(BookingResult);
        }

        public Task<int> ExpireHoldsAsync(CancellationToken ct)
        {
            ExpireHoldsCalls++;
            return Task.FromResult(expireBatches.Count > 0 ? expireBatches.Dequeue() : 0);
        }

        public Task<IReadOnlyList<LotView>> ListLotsAsync(CancellationToken ct) => throw new NotImplementedException();
        public Task<bool> LotExistsAsync(Guid lotId, CancellationToken ct) => throw new NotImplementedException();
        public Task<BookingView> CreateBookingAsync(Guid customerId, BookingRequest request, string key, CancellationToken ct) => throw new NotImplementedException();
        public Task<LotAvailabilityDto> GetLotAvailabilityAsync(Guid lotId, DateTimeOffset? startTime, DateTimeOffset? endTime, string? vehicleType, Guid? levelId, CancellationToken ct) => throw new NotImplementedException();
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
