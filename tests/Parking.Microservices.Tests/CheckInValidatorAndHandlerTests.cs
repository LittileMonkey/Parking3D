using FluentValidation.TestHelper;
using Parking.Parking.Application;
using Parking.Parking.Application.DTOs;
using Parking.Parking.Application.Exceptions;
using Parking.Parking.Application.Features.Bookings.Commands;
using Parking.Parking.Application.Interfaces;
using Parking.ServiceDefaults;
using Xunit;

namespace Parking.Microservices.Tests;

/// <summary>
/// Bộ Unit Tests kiểm thử nghiệp vụ Check-In tự động và khách vãng lai (SCRUM-69).
/// Bao phủ: Validation, Phân quyền Facility-Scoped RBAC, Phân luồng QR vs Walk-In, Override lệch biển số.
/// </summary>
public class CheckInValidatorAndHandlerTests
{
    private readonly CheckInCommandValidator _validator = new();

    [Fact]
    public void Validator_ShouldPass_ForValidQrBookingCheckIn()
    {
        var command = new CheckInCommand(
            ActorId: Guid.NewGuid(),
            Request: new CheckInRequestDto(
                LotId: Guid.NewGuid(),
                GateId: Guid.NewGuid(),
                QrPayload: "PARK1.sample.qr.payload",
                DetectedPlate: "51A-123.45"),
            IdempotencyKey: "test-idempotency-key-01");

        var result = _validator.TestValidate(command);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Validator_ShouldPass_ForValidWalkInCheckIn_WithNullOrEmptyQr()
    {
        var command = new CheckInCommand(
            ActorId: Guid.NewGuid(),
            Request: new CheckInRequestDto(
                LotId: Guid.NewGuid(),
                GateId: Guid.NewGuid(),
                QrPayload: null,
                DetectedPlate: "51A-888.99",
                VehicleType: "CAR"),
            IdempotencyKey: "test-walk-in-key-01");

        var result = _validator.TestValidate(command);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Validator_ShouldFail_WhenWalkInVehicleTypeIsUnsupported()
    {
        var command = new CheckInCommand(
            ActorId: Guid.NewGuid(),
            Request: new CheckInRequestDto(
                LotId: Guid.NewGuid(),
                GateId: Guid.NewGuid(),
                QrPayload: null,
                DetectedPlate: "51A-888.99",
                VehicleType: "TRUCK"),
            IdempotencyKey: "test-walk-in-invalid-vtype");

        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Request.VehicleType);
    }

    [Fact]
    public void Validator_ShouldPass_WhenWalkInVehicleTypeIsCaseInsensitiveSupported()
    {
        var command = new CheckInCommand(
            ActorId: Guid.NewGuid(),
            Request: new CheckInRequestDto(
                LotId: Guid.NewGuid(),
                GateId: Guid.NewGuid(),
                QrPayload: null,
                DetectedPlate: "51G-888.99",
                VehicleType: " motorbike "),
            IdempotencyKey: "test-walk-in-motorbike");

        var result = _validator.TestValidate(command);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Validator_ShouldFail_WhenActorOrIdempotencyKeyOrLotOrGateMissing()
    {
        var command = new CheckInCommand(
            ActorId: Guid.Empty,
            Request: new CheckInRequestDto(
                LotId: Guid.Empty,
                GateId: Guid.Empty,
                QrPayload: null,
                DetectedPlate: "51A-123.45"),
            IdempotencyKey: string.Empty);

        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.ActorId);
        result.ShouldHaveValidationErrorFor(x => x.IdempotencyKey);
        result.ShouldHaveValidationErrorFor(x => x.Request.LotId);
        result.ShouldHaveValidationErrorFor(x => x.Request.GateId);
    }

    [Fact]
    public void Validator_ShouldFail_WhenDetectedPlateIsInvalid()
    {
        var command = new CheckInCommand(
            ActorId: Guid.NewGuid(),
            Request: new CheckInRequestDto(
                LotId: Guid.NewGuid(),
                GateId: Guid.NewGuid(),
                QrPayload: null,
                DetectedPlate: "###INVALID_PLATE###"),
            IdempotencyKey: "key-01");

        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Request.DetectedPlate);
    }

    [Fact]
    public void Validator_ShouldFail_WhenPlateMismatchOverrideAllowed_WithoutReason()
    {
        var command = new CheckInCommand(
            ActorId: Guid.NewGuid(),
            Request: new CheckInRequestDto(
                LotId: Guid.NewGuid(),
                GateId: Guid.NewGuid(),
                QrPayload: "PARK1.qr",
                DetectedPlate: "51A-123.45",
                AllowMismatchOverride: true,
                OverrideReason: null),
            IdempotencyKey: "key-override-missing-reason");

        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Request.OverrideReason);
    }

    [Fact]
    public void Validator_ShouldPass_WhenPlateMismatchOverrideAllowed_WithValidReason()
    {
        var command = new CheckInCommand(
            ActorId: Guid.NewGuid(),
            Request: new CheckInRequestDto(
                LotId: Guid.NewGuid(),
                GateId: Guid.NewGuid(),
                QrPayload: "PARK1.qr",
                DetectedPlate: "51A-123.45",
                AllowMismatchOverride: true,
                OverrideReason: "Staff verified physical vehicle registration documents"),
            IdempotencyKey: "key-override-with-reason");

        var result = _validator.TestValidate(command);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public async Task Handler_ShouldEnforce_FacilityScopedRbac_CheckInCapability()
    {
        var actorId = Guid.NewGuid();
        var lotId = Guid.NewGuid();

        var access = new StubFacilityAccess { AllowAccess = false };
        var repo = new StubParkingRepository();
        var qr = new StubQrTokenService();
        var handler = new CheckInCommandHandler(repo, qr, access);

        var command = new CheckInCommand(
            ActorId: actorId,
            Request: new CheckInRequestDto(lotId, Guid.NewGuid(), null, "51A-123.45"),
            IdempotencyKey: "key-rbac");

        var error = await Assert.ThrowsAsync<ServiceException>(() => handler.Handle(command, CancellationToken.None));
        Assert.Equal(403, error.StatusCode);
        Assert.Equal("CHECK_IN", access.LastCheckedCapability);
    }

    [Fact]
    public async Task Handler_ShouldCall_CheckInWalkInAsync_WhenQrPayloadIsEmpty()
    {
        var actorId = Guid.NewGuid();
        var lotId = Guid.NewGuid();
        var gateId = Guid.NewGuid();
        var slotId = Guid.NewGuid();
        var sessionId = Guid.NewGuid();
        var entryAt = DateTimeOffset.UtcNow;

        var expectedResponse = new CheckInResponseDto(
            SessionId: sessionId,
            BookingId: null,
            LotId: lotId,
            SlotId: slotId,
            Status: "ACTIVE",
            EntryAt: entryAt,
            SlotCode: "A01",
            VehicleType: "CAR",
            EntryMethod: "WALK_IN");

        var access = new StubFacilityAccess { AllowAccess = true };
        var repo = new StubParkingRepository { WalkInResult = expectedResponse };
        var qr = new StubQrTokenService();
        var handler = new CheckInCommandHandler(repo, qr, access);

        var command = new CheckInCommand(
            ActorId: actorId,
            Request: new CheckInRequestDto(lotId, gateId, null, "51A-999.88", "CAR"),
            IdempotencyKey: "key-walkin");

        var response = await handler.Handle(command, CancellationToken.None);

        Assert.NotNull(response);
        Assert.Equal(sessionId, response.SessionId);
        Assert.Null(response.BookingId);
        Assert.Equal("WALK_IN", response.EntryMethod);
        Assert.Equal("ACTIVE", response.Status);
        Assert.True(repo.WalkInCalled);
        Assert.False(repo.QrCheckInCalled);
    }

    [Fact]
    public async Task Handler_ShouldCall_CheckInAsync_WhenQrPayloadIsValid()
    {
        var actorId = Guid.NewGuid();
        var lotId = Guid.NewGuid();
        var gateId = Guid.NewGuid();
        var slotId = Guid.NewGuid();
        var bookingId = Guid.NewGuid();
        var vehicleId = Guid.NewGuid();
        var sessionId = Guid.NewGuid();
        var entryAt = DateTimeOffset.UtcNow;

        var expectedResponse = new CheckInResponseDto(
            SessionId: sessionId,
            BookingId: bookingId,
            LotId: lotId,
            SlotId: slotId,
            Status: "ACTIVE",
            EntryAt: entryAt,
            SlotCode: "B02",
            VehicleType: "CAR",
            EntryMethod: "QR");

        var access = new StubFacilityAccess { AllowAccess = true };
        var repo = new StubParkingRepository { QrResult = expectedResponse };
        var qr = new StubQrTokenService
        {
            ValidToken = new ValidatedQrToken(bookingId, lotId, vehicleId, "sample-nonce-hash", DateTimeOffset.UtcNow.AddHours(1))
        };
        var handler = new CheckInCommandHandler(repo, qr, access);

        var command = new CheckInCommand(
            ActorId: actorId,
            Request: new CheckInRequestDto(lotId, gateId, "valid-qr-payload", "51A-123.45"),
            IdempotencyKey: "key-qr");

        var response = await handler.Handle(command, CancellationToken.None);

        Assert.NotNull(response);
        Assert.Equal(sessionId, response.SessionId);
        Assert.Equal(bookingId, response.BookingId);
        Assert.Equal("QR", response.EntryMethod);
        Assert.True(repo.QrCheckInCalled);
        Assert.False(repo.WalkInCalled);
    }

    [Fact]
    public async Task Handler_ShouldReject_WhenQrTokenBelongsToDifferentLot()
    {
        var actorId = Guid.NewGuid();
        var lotId = Guid.NewGuid();
        var differentLotId = Guid.NewGuid();

        var access = new StubFacilityAccess { AllowAccess = true };
        var repo = new StubParkingRepository();
        var qr = new StubQrTokenService
        {
            ValidToken = new ValidatedQrToken(Guid.NewGuid(), differentLotId, Guid.NewGuid(), "nonce-hash", DateTimeOffset.UtcNow.AddHours(1))
        };
        var handler = new CheckInCommandHandler(repo, qr, access);

        var command = new CheckInCommand(
            ActorId: actorId,
            Request: new CheckInRequestDto(lotId, Guid.NewGuid(), "mismatched-lot-qr", "51A-123.45"),
            IdempotencyKey: "key-diff-lot");

        var ex = await Assert.ThrowsAsync<ConflictException>(() => handler.Handle(command, CancellationToken.None));
        Assert.Contains("does not belong to the requested parking lot", ex.Message);
    }

    // ─── Test Doubles / Stubs ────────────────────────────────────────────────

    private sealed class StubFacilityAccess : IFacilityAccess
    {
        public bool AllowAccess { get; set; } = true;
        public string? LastCheckedCapability { get; private set; }

        public Task RequireAsync(Guid actorId, Guid lotId, string capability, CancellationToken ct)
        {
            LastCheckedCapability = capability;
            if (!AllowAccess)
                throw new ServiceException(403, $"Staff denied for {capability}");
            return Task.CompletedTask;
        }
    }

    private sealed class StubQrTokenService : IQrTokenService
    {
        public ValidatedQrToken? ValidToken { get; set; }

        public GeneratedQrToken GenerateToken(Guid bookingId, Guid lotId, Guid vehicleId, DateTimeOffset arrivalDeadline)
            => new("sample-qr", "sample-nonce-hash", arrivalDeadline);

        public bool TryValidateAndExtract(string qrPayload, out ValidatedQrToken? token)
        {
            token = ValidToken;
            return ValidToken is not null;
        }
    }

    private sealed class StubParkingRepository : IParkingRepository
    {
        public bool QrCheckInCalled { get; private set; }
        public bool WalkInCalled { get; private set; }
        public CheckInResponseDto? QrResult { get; set; }
        public CheckInResponseDto? WalkInResult { get; set; }

        public Task<CheckInResponseDto> CheckInAsync(Guid actorId, CheckInRequestDto request, ValidatedQrToken token, string key, CancellationToken ct)
        {
            QrCheckInCalled = true;
            return Task.FromResult(QrResult!);
        }

        public Task<CheckInResponseDto> CheckInWalkInAsync(Guid actorId, CheckInRequestDto request, string key, CancellationToken ct)
        {
            WalkInCalled = true;
            return Task.FromResult(WalkInResult!);
        }

        public Task<IReadOnlyList<LotView>> ListLotsAsync(CancellationToken ct) => throw new NotImplementedException();
        public Task<bool> LotExistsAsync(Guid lotId, CancellationToken ct) => throw new NotImplementedException();
        public Task<BookingView> CreateBookingAsync(Guid customerId, BookingRequest request, string key, CancellationToken ct) => throw new NotImplementedException();
        public Task<LotAvailabilityDto> GetLotAvailabilityAsync(Guid lotId, DateTimeOffset? startTime, DateTimeOffset? endTime, string? vehicleType, Guid? levelId, CancellationToken ct) => throw new NotImplementedException();
        public Task<(BookingDetailDto Detail, Guid? CustomerId, Guid LotId)?> GetBookingDetailAsync(Guid bookingId, CancellationToken ct) => throw new NotImplementedException();
        public Task<int> ExpireHoldsAsync(CancellationToken ct) => throw new NotImplementedException();
        public Task<BookingQrContextDto?> GetBookingQrContextAsync(Guid bookingId, CancellationToken ct) => throw new NotImplementedException();
        public Task SaveIssuedQrTokenAsync(Guid bookingId, Guid expectedLotId, Guid expectedVehicleId, GeneratedQrToken token, CancellationToken ct) => throw new NotImplementedException();
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

