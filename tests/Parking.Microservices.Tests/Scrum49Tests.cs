using FluentValidation.TestHelper;
using Microsoft.Extensions.Configuration;
using Parking.Parking.Application;
using Parking.Parking.Application.DTOs;
using Parking.Parking.Application.Exceptions;
using Parking.Parking.Application.Features.Bookings.Commands;
using Parking.Parking.Application.Interfaces;
using Parking.Parking.Infrastructure.Services;
using Parking.ServiceDefaults;
using Xunit;

namespace Parking.Microservices.Tests;

/// <summary>Unit tests for SCRUM-49 (QR issuance and staff check-in handlers/validators).</summary>
public sealed class Scrum49Tests
{
    private sealed class FixedClock(DateTimeOffset utcNow) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => utcNow;
    }

    [Fact]
    public void IssueBookingQrValidator_RejectsEmptyIdsAndAcceptsValidIds()
    {
        var validator = new IssueBookingQrCommandValidator();

        var invalid = validator.TestValidate(new IssueBookingQrCommand(Guid.Empty, Guid.Empty));
        invalid.ShouldHaveValidationErrorFor(x => x.BookingId);
        invalid.ShouldHaveValidationErrorFor(x => x.RequestingUserId);

        var valid = validator.TestValidate(new IssueBookingQrCommand(Guid.NewGuid(), Guid.NewGuid()));
        valid.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public async Task IssueBookingQrHandler_ChecksActiveUserBeforeLookupAndRejectsMissingBooking()
    {
        var userId = Guid.NewGuid();
        var bookingId = Guid.NewGuid();
        var clock = new FixedClock(new DateTimeOffset(2026, 11, 12, 5, 0, 0, TimeSpan.Zero));
        var access = new StubFacilityAccess { DenyUserCheck = true };
        var repo = new StubQrRepository();
        var handler = new IssueBookingQrCommandHandler(repo, CreateQrService(clock), access, clock);

        var suspendedEx = await Assert.ThrowsAsync<ServiceException>(() =>
            handler.Handle(new IssueBookingQrCommand(bookingId, userId), CancellationToken.None));
        Assert.Equal(403, suspendedEx.StatusCode);
        Assert.Equal(0, repo.GetContextCalls);

        access.DenyUserCheck = false;
        await Assert.ThrowsAsync<NotFoundException>(() =>
            handler.Handle(new IssueBookingQrCommand(bookingId, userId), CancellationToken.None));
        Assert.Equal(1, repo.GetContextCalls);
        Assert.Equal([(userId, Guid.Empty, "USER"), (userId, Guid.Empty, "USER")], access.Checks);
    }

    [Fact]
    public async Task IssueBookingQrHandler_OwnerSkipsFacilityLookupAndNonOwnerRequiresLookupAtLot()
    {
        var ownerId = Guid.NewGuid();
        var staffId = Guid.NewGuid();
        var otherUserId = Guid.NewGuid();
        var lotId = Guid.NewGuid();
        var bookingId = Guid.NewGuid();
        var now = new DateTimeOffset(2026, 11, 12, 5, 0, 0, TimeSpan.Zero);
        var clock = new FixedClock(now);
        var context = new BookingQrContextDto(
            bookingId, "BCODE1", lotId, Guid.NewGuid(), ownerId, "CONFIRMED",
            now.AddMinutes(30), now.AddMinutes(60));

        // Booking owner skips LOOKUP check.
        var ownerAccess = new StubFacilityAccess();
        var ownerRepo = new StubQrRepository { Context = context };
        var ownerHandler = new IssueBookingQrCommandHandler(ownerRepo, CreateQrService(clock), ownerAccess, clock);

        var ownerQr = await ownerHandler.Handle(new IssueBookingQrCommand(bookingId, ownerId), CancellationToken.None);
        Assert.Equal(bookingId, ownerQr.BookingId);
        Assert.Equal("BCODE1", ownerQr.BookingCode);
        Assert.Equal(now.AddMinutes(30), ownerQr.ExpiresAt);
        Assert.Single(ownerAccess.Checks);
        Assert.Equal(1, ownerRepo.SaveCalls);

        // Non-owner requires LOOKUP at booking.LotId.
        var staffAccess = new StubFacilityAccess { AllowLookup = true };
        var staffRepo = new StubQrRepository { Context = context };
        var staffHandler = new IssueBookingQrCommandHandler(staffRepo, CreateQrService(clock), staffAccess, clock);

        var staffQr = await staffHandler.Handle(new IssueBookingQrCommand(bookingId, staffId), CancellationToken.None);
        Assert.StartsWith("PARK1.", staffQr.QrPayload, StringComparison.Ordinal);
        Assert.Equal([(staffId, Guid.Empty, "USER"), (staffId, lotId, "LOOKUP")], staffAccess.Checks);
        Assert.Equal(1, staffRepo.SaveCalls);

        // Unauthorized third-party gets 403 before generating or saving QR.
        var deniedAccess = new StubFacilityAccess { AllowLookup = false };
        var deniedRepo = new StubQrRepository { Context = context };
        var deniedHandler = new IssueBookingQrCommandHandler(deniedRepo, CreateQrService(clock), deniedAccess, clock);

        var deniedEx = await Assert.ThrowsAsync<ServiceException>(() =>
            deniedHandler.Handle(new IssueBookingQrCommand(bookingId, otherUserId), CancellationToken.None));
        Assert.Equal(403, deniedEx.StatusCode);
        Assert.Equal(0, deniedRepo.SaveCalls);
    }

    [Theory]
    [InlineData("PENDING_PAYMENT", 10, 60)]
    [InlineData("EXPIRED", 10, 60)]
    [InlineData("CANCELLED", 10, 60)]
    [InlineData("CONFIRMED", 0, 60)]
    [InlineData("CONFIRMED", -5, 60)]
    [InlineData("CONFIRMED", 30, 0)]
    [InlineData("CONFIRMED", 30, -5)]
    public async Task IssueBookingQrHandler_RejectsUnconfirmedOrExpiredWindow(
        string status, int arrivalOffsetMinutes, int endsOffsetMinutes)
    {
        var ownerId = Guid.NewGuid();
        var bookingId = Guid.NewGuid();
        var now = new DateTimeOffset(2026, 11, 12, 5, 0, 0, TimeSpan.Zero);
        var clock = new FixedClock(now);
        var repo = new StubQrRepository
        {
            Context = new BookingQrContextDto(
                bookingId, "BCODE2", Guid.NewGuid(), Guid.NewGuid(), ownerId, status,
                now.AddMinutes(arrivalOffsetMinutes), now.AddMinutes(endsOffsetMinutes))
        };
        var handler = new IssueBookingQrCommandHandler(repo, CreateQrService(clock), new StubFacilityAccess(), clock);

        await Assert.ThrowsAsync<ConflictException>(() =>
            handler.Handle(new IssueBookingQrCommand(bookingId, ownerId), CancellationToken.None));
        Assert.Equal(0, repo.SaveCalls);
    }

    [Fact]
    public async Task IssueBookingQrHandler_CapsQrExpiryToBookingEndsAtWhenEndsBeforeArrivalDeadline()
    {
        var ownerId = Guid.NewGuid();
        var bookingId = Guid.NewGuid();
        var now = new DateTimeOffset(2026, 11, 12, 5, 0, 0, TimeSpan.Zero);
        var clock = new FixedClock(now);
        var endsAt = now.AddMinutes(15);
        var arrivalDeadline = now.AddMinutes(30);
        var repo = new StubQrRepository
        {
            Context = new BookingQrContextDto(
                bookingId, "BCODE3", Guid.NewGuid(), Guid.NewGuid(), ownerId, "CONFIRMED",
                arrivalDeadline, endsAt)
        };
        var handler = new IssueBookingQrCommandHandler(repo, CreateQrService(clock), new StubFacilityAccess(), clock);

        var result = await handler.Handle(new IssueBookingQrCommand(bookingId, ownerId), CancellationToken.None);

        Assert.Equal(endsAt, result.ExpiresAt);
        Assert.Equal(endsAt, repo.LastSavedToken!.ExpiresAt);
    }

    [Fact]
    public void CheckInValidator_RejectsWhitespaceOnlyQrPayloadWhileAllowingNullOrEmptyWalkIn()
    {
        var validator = new CheckInCommandValidator();
        var lotId = Guid.NewGuid();
        var gateId = Guid.NewGuid();
        var actorId = Guid.NewGuid();

        var whitespaceResult = validator.TestValidate(new CheckInCommand(
            actorId, new CheckInRequestDto(lotId, gateId, "   ", "51A-123.45"), "key-ws"));
        whitespaceResult.ShouldHaveValidationErrorFor(x => x.Request.QrPayload);

        var emptyResult = validator.TestValidate(new CheckInCommand(
            actorId, new CheckInRequestDto(lotId, gateId, "", "51A-123.45"), "key-empty"));
        emptyResult.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public async Task CheckInHandler_DoesNotTreatWhitespaceQrPayloadAsWalkIn()
    {
        var clock = new FixedClock(new DateTimeOffset(2026, 11, 12, 5, 0, 0, TimeSpan.Zero));
        var repo = new StubQrRepository();
        var access = new StubFacilityAccess { AllowLookup = true };
        var handler = new CheckInCommandHandler(repo, CreateQrService(clock), access);

        await Assert.ThrowsAsync<ConflictException>(() =>
            handler.Handle(new CheckInCommand(
                Guid.NewGuid(),
                new CheckInRequestDto(Guid.NewGuid(), Guid.NewGuid(), "   ", "51A-123.45"),
                "key-ws-handler"), CancellationToken.None));
        Assert.False(repo.WalkInCalled);
    }

    private static QrTokenService CreateQrService(TimeProvider clock) =>
        new(new ConfigurationBuilder().AddInMemoryCollection(
            new Dictionary<string, string?> { ["Qr:SigningKey"] = new string('k', 64) }).Build(), clock);

    private sealed class StubFacilityAccess : IFacilityAccess
    {
        public bool DenyUserCheck { get; set; }
        public bool AllowLookup { get; set; } = true;
        public List<(Guid UserId, Guid LotId, string Capability)> Checks { get; } = [];

        public Task RequireAsync(Guid userId, Guid lotId, string capability, CancellationToken ct)
        {
            Checks.Add((userId, lotId, capability));
            if (capability == "USER" && DenyUserCheck)
                throw new ServiceException(403, "User suspended.");
            if (capability == "LOOKUP" && !AllowLookup)
                throw new ServiceException(403, "Forbidden lookup.");
            return Task.CompletedTask;
        }
    }

    private sealed class StubQrRepository : IParkingRepository
    {
        public BookingQrContextDto? Context { get; set; }
        public int GetContextCalls { get; private set; }
        public int SaveCalls { get; private set; }
        public GeneratedQrToken? LastSavedToken { get; private set; }
        public bool WalkInCalled { get; private set; }

        public Task<BookingQrContextDto?> GetBookingQrContextAsync(Guid bookingId, CancellationToken ct)
        {
            GetContextCalls++;
            return Task.FromResult(Context);
        }

        public Task SaveIssuedQrTokenAsync(Guid bookingId, Guid expectedLotId, Guid expectedVehicleId, GeneratedQrToken token, CancellationToken ct)
        {
            SaveCalls++;
            LastSavedToken = token;
            return Task.CompletedTask;
        }

        public Task<CheckInResponseDto> CheckInWalkInAsync(Guid actorId, CheckInRequestDto request, string key, CancellationToken ct)
        {
            WalkInCalled = true;
            throw new NotImplementedException();
        }

        public Task<IReadOnlyList<LotView>> ListLotsAsync(CancellationToken ct) => throw new NotImplementedException();
        public Task<bool> LotExistsAsync(Guid lotId, CancellationToken ct) => throw new NotImplementedException();
        public Task<BookingView> CreateBookingAsync(Guid customerId, BookingRequest request, string key, CancellationToken ct) => throw new NotImplementedException();
        public Task<LotAvailabilityDto> GetLotAvailabilityAsync(Guid lotId, DateTimeOffset? startTime, DateTimeOffset? endTime, string? vehicleType, Guid? levelId, CancellationToken ct) => throw new NotImplementedException();
        public Task<(BookingDetailDto Detail, Guid? CustomerId, Guid LotId)?> GetBookingDetailAsync(Guid bookingId, CancellationToken ct) => throw new NotImplementedException();
        public Task<int> ExpireHoldsAsync(CancellationToken ct) => throw new NotImplementedException();
        public Task<CheckInResponseDto> CheckInAsync(Guid actorId, CheckInRequestDto request, ValidatedQrToken token, string key, CancellationToken ct) => throw new NotImplementedException();
        public Task<CheckOutQuoteResultDto> GetCheckOutQuoteAsync(Guid lotId, Guid gateId, string detectedPlate, string? qrPayload, CancellationToken ct, Guid? sessionId = null) => throw new NotImplementedException();
        public Task<ConfirmCheckOutResultDto?> GetCheckOutReplayAsync(Guid actorId, ConfirmCheckOutRequestDto request, string key, CancellationToken ct) => throw new NotImplementedException();
        public Task RecordCheckOutMismatchAsync(Guid sessionId, Guid actorId, string observedPlate, CancellationToken ct) => throw new NotImplementedException();
        public Task<AuthorizeCheckOutResultDto?> ClaimCheckOutAuthorizationAsync(Guid actorId, ConfirmCheckOutRequestDto request, string key, CancellationToken ct) => throw new NotImplementedException();
        public Task<AuthorizeCheckOutResultDto> SaveCheckOutAuthorizationAsync(Guid actorId, ConfirmCheckOutRequestDto request, string key, AuthorizeCheckOutResultDto result, CancellationToken ct) => throw new NotImplementedException();
        public Task<Guid?> GetSessionLotIdAsync(Guid sessionId, CancellationToken ct) => throw new NotImplementedException();
        public Task<ConfirmCheckOutResultDto> CompleteCheckOutAsync(Guid actorId, ConfirmCheckOutRequestDto request, string key, CancellationToken ct, CheckOutVerification? verification = null) => throw new NotImplementedException();

        // SCRUM-99 Incidents stubs
        public Task<IncidentDto> CreateIncidentAsync(Guid lotId, Guid actorId, CreateIncidentRequestDto request, string? key, CancellationToken ct) => throw new NotImplementedException();
        public Task<PagedResult<IncidentSummaryDto>> ListIncidentsAsync(Guid lotId, string? status, string? severity, string? query, int page, int pageSize, CancellationToken ct) => throw new NotImplementedException();
        public Task<IncidentDto?> GetIncidentByIdAsync(Guid lotId, Guid incidentId, CancellationToken ct) => throw new NotImplementedException();
        public Task<IncidentDto> UpdateIncidentStatusAsync(Guid lotId, Guid incidentId, Guid actorId, UpdateIncidentStatusRequestDto request, CancellationToken ct) => throw new NotImplementedException();
        public Task<PagedResult<IncidentHistoryItemDto>> GetIncidentHistoryAsync(Guid lotId, Guid incidentId, int page, int pageSize, CancellationToken ct) => throw new NotImplementedException();
        public Task<IncidentDto> ReopenIncidentAsync(Guid lotId, Guid incidentId, Guid actorId, ReopenIncidentRequestDto request, CancellationToken ct) => throw new NotImplementedException();
        public Task<IncidentDto> CancelIncidentAsync(Guid lotId, Guid incidentId, Guid actorId, CancelIncidentRequestDto request, CancellationToken ct) => throw new NotImplementedException();
        public Task<IncidentExitDecisionDto> CreateIncidentDecisionAsync(Guid lotId, Guid incidentId, Guid actorId, CreateIncidentDecisionRequestDto request, CancellationToken ct) => throw new NotImplementedException();

        // SCRUM-99 Shift Handover stubs
        public Task<ShiftHandoverDto> CreateShiftHandoverAsync(Guid lotId, Guid actorId, CreateShiftHandoverRequestDto request, string? key, CancellationToken ct) => throw new NotImplementedException();
        public Task<PagedResult<ShiftHandoverSummaryDto>> ListShiftHandoversAsync(Guid lotId, Guid actorId, bool isManager, string? status, int page, int pageSize, CancellationToken ct) => throw new NotImplementedException();
        public Task<ShiftHandoverDto?> GetShiftHandoverByIdAsync(Guid lotId, Guid handoverId, Guid actorId, bool isManager, CancellationToken ct) => throw new NotImplementedException();
        public Task<ShiftHandoverDto> ConfirmShiftHandoverAsync(Guid lotId, Guid handoverId, Guid actorId, ConfirmShiftHandoverRequestDto request, string? key, CancellationToken ct) => throw new NotImplementedException();
        public Task<ShiftHandoverDto> ReassignReceiverAsync(Guid lotId, Guid handoverId, Guid actorId, ReassignReceiverRequestDto request, CancellationToken ct) => throw new NotImplementedException();
    }
}
