using FluentValidation.TestHelper;
using Parking.Parking.Application.DTOs;
using Parking.Parking.Application.Exceptions;
using Parking.Parking.Application.Features.CheckOut.Commands;
using Parking.Parking.Application.Interfaces;
using Xunit;
using Microsoft.Extensions.Configuration;
using Parking.Parking.Application;
using Parking.Parking.Domain;
using Parking.Parking.Infrastructure.Services;
using Parking.ServiceDefaults;

namespace Parking.Microservices.Tests;

public sealed class CheckOutHardeningTests
{
    private sealed class Clock : TimeProvider
    {
        public DateTimeOffset Now { get; set; } = DateTimeOffset.UtcNow;
        public override DateTimeOffset GetUtcNow()=>Now;
    }

    [Fact]
    public void SignedQuoteRejectsTamperingWrongKeyExpiryAndEntryQr()
    {
        var clock=new Clock();
        var config=new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string,string?>{["Qr:SigningKey"]=new string('s',64)}).Build();
        var tokens=new CheckOutTokens(config,clock);
        var proof=new CheckOutProof(Guid.NewGuid(),Guid.NewGuid(),Guid.NewGuid(),Guid.NewGuid(),Guid.NewGuid(),
            Guid.NewGuid(),Guid.NewGuid(),Guid.NewGuid(),"51A12345",clock.Now,clock.Now.AddMinutes(5),7500);
        var token=tokens.SignQuote(proof);
        Assert.Equal(proof,tokens.ValidateQuote(token));
        Assert.Throws<ServiceException>(()=>tokens.ValidateQuote(token[..^1]+(token[^1]=='0'?'1':'0')));
        var wrong=new CheckOutTokens(new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string,string?>{["Qr:SigningKey"]=new string('w',64)}).Build(),clock);
        Assert.Throws<ServiceException>(()=>wrong.ValidateQuote(token));
        var entry=new QrTokenService(config,clock).GenerateToken(Guid.NewGuid(),proof.LotId,proof.VehicleId,clock.Now.AddMinutes(5));
        Assert.Throws<ServiceException>(()=>tokens.ValidateExitQr(entry.QrPayload));
        var exit=tokens.IssueExitQr(proof.SessionId,proof.LotId);
        Assert.Equal((proof.SessionId,proof.LotId),tokens.ValidateExitQr(exit.QrPayload));
        Assert.Throws<ServiceException>(()=>tokens.ValidateQuote(exit.QrPayload));
        clock.Now=proof.ExpiresAt;
        Assert.Throws<ServiceException>(()=>tokens.ValidateQuote(token));
        Assert.Throws<ServiceException>(()=>tokens.ValidateExitQr(exit.QrPayload));
    }

    [Theory]
    [InlineData(0,0)]
    [InlineData(1,7500)]
    [InlineData(30,7500)]
    [InlineData(60,7500)]
    [InlineData(900,7500)]
    [InlineData(901,15000)]
    public void FeeUsesExactTimeAndRoundsUpBlocks(int seconds,long expected)
    {
        var end=DateTimeOffset.Parse("2026-11-01T10:00:00+07:00");
        var amount=CheckOutFee.Calculate(true,end.AddHours(-1),end,end.AddSeconds(seconds),
            "{\"blockMinutes\":15,\"rateVnd\":7500,\"dailyCapVnd\":120000,\"multiplier\":1}",TimeZoneInfo.Utc.Id);
        Assert.Equal(expected,amount);
    }

    [Theory]
    [InlineData(0,0)]
    [InlineData(899,7500)]
    [InlineData(900,7500)]
    [InlineData(901,15000)]
    public void FeeKeepsBookedBlockBoundariesWhenDriverEntersEarly(int seconds,long expected)
    {
        var start=DateTimeOffset.Parse("2026-11-01T10:00:00+07:00");
        var end=start.AddHours(1);
        var entry=start.AddMinutes(-2);
        var amount=CheckOutFee.Calculate(true,entry,end,end.AddSeconds(seconds),
            "{\"blockMinutes\":15,\"rateVnd\":7500,\"dailyCapVnd\":120000,\"multiplier\":1}",TimeZoneInfo.Utc.Id,start);
        Assert.Equal(expected,amount);
    }

    [Theory]
    [InlineData(1,7500)]
    [InlineData(899,7500)]
    [InlineData(901,15000)]
    public void FeeCountsExactOvertimeFromExpectedExitEvenWithMicrosecondBookingDrift(int seconds,long expected)
    {
        var start=DateTimeOffset.Parse("2026-11-01T10:00:00+07:00");
        var end=start.AddHours(1).AddTicks(50);
        var entry=start.AddMinutes(-2);
        var amount=CheckOutFee.Calculate(true,entry,end,end.AddSeconds(seconds),
            "{\"blockMinutes\":15,\"rateVnd\":7500,\"dailyCapVnd\":120000,\"multiplier\":1}",TimeZoneInfo.Utc.Id,start);
        Assert.Equal(expected,amount);
    }

    [Fact]
    public void BookingAlreadyAtDailyCapDoesNotPayTheCapAgainForOvertime()
    {
        var start=DateTimeOffset.Parse("2026-11-01T08:00:00Z");
        var end=start.AddHours(4);
        var fee=CheckOutFee.Calculate(true,start,end,end.AddSeconds(1),
            "{\"blockMinutes\":15,\"rateVnd\":7500,\"dailyCapVnd\":120000,\"multiplier\":1}","UTC");
        Assert.Equal(0,fee);
    }
    [Fact]
    public void ConfirmRequiresObservedPlateAndServerQuote()
    {
        var command = new ConfirmCheckOutCommand(Guid.NewGuid(),
            new ConfirmCheckOutRequestDto(Guid.NewGuid(), Guid.NewGuid(), "NONE"), "exit");
        var result = new ConfirmCheckOutCommandValidator().TestValidate(command);
        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.PropertyName == "Request.DetectedPlate");
        Assert.Contains(result.Errors, error => error.PropertyName == "Request.QuoteToken");
        Assert.Contains(result.Errors, error => error.PropertyName == "Request.StaffObservedExit");
    }

    [Fact]
    public void PrepaidIsNotAnUnverifiedPaymentOverride()
    {
        var command = new ConfirmCheckOutCommand(Guid.NewGuid(),
            new ConfirmCheckOutRequestDto(Guid.NewGuid(), Guid.NewGuid(), "PREPAID"), "exit");
        var result = new ConfirmCheckOutCommandValidator().TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Request.PaymentMethod);
    }

    [Fact]
    public async Task AuthorizeCheckOut_ValidatesQuoteBeforeClaimingIdempotency()
    {
        var clock = new Clock();
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["Qr:SigningKey"] = new string('s', 64) }).Build();
        var tokens = new CheckOutTokens(config, clock);
        var actorId = Guid.NewGuid();
        var lotId = Guid.NewGuid();
        var gateId = Guid.NewGuid();
        var sessionId = Guid.NewGuid();
        var slotId = Guid.NewGuid();
        var vehicleId = Guid.NewGuid();
        var snapshotId = Guid.NewGuid();

        var proof = new CheckOutProof(Guid.NewGuid(), actorId, sessionId, lotId, gateId, slotId, vehicleId,
            snapshotId, "51A12345", clock.Now, clock.Now.AddMinutes(5), 5000);
        var token = tokens.SignQuote(proof);

        var repo = new AuthTestRepo(lotId, new CheckOutQuoteResultDto(
            sessionId, null, slotId, "A01", "51A12345", "51A99999", false,
            clock.Now.AddHours(-1), clock.Now, clock.Now, 60, 0, 0, 5000, 5000, true,
            null, token, proof.ExpiresAt, snapshotId, vehicleId));

        var handler = new AuthorizeCheckOutCommandHandler(repo, new AuthTestAccess(), tokens, new AuthTestPayments());
        var request = new ConfirmCheckOutRequestDto(sessionId, gateId, "CASH", 5000,
            DetectedPlate: "51A99999", QuoteToken: token);

        await Assert.ThrowsAsync<ConflictException>(() =>
            handler.Handle(new AuthorizeCheckOutCommand(actorId, request, "auth-key-1"), CancellationToken.None));

        Assert.True(repo.MismatchRecorded);
        Assert.False(repo.ClaimCalled);
        Assert.False(repo.ReleaseCalled);
    }

    [Fact]
    public async Task AuthorizeCheckOut_ReleasesClaim_WhenPaymentSettlementThrows()
    {
        var clock = new Clock();
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["Qr:SigningKey"] = new string('s', 64) }).Build();
        var tokens = new CheckOutTokens(config, clock);
        var actorId = Guid.NewGuid();
        var lotId = Guid.NewGuid();
        var gateId = Guid.NewGuid();
        var sessionId = Guid.NewGuid();
        var slotId = Guid.NewGuid();
        var vehicleId = Guid.NewGuid();
        var snapshotId = Guid.NewGuid();

        var proof = new CheckOutProof(Guid.NewGuid(), actorId, sessionId, lotId, gateId, slotId, vehicleId,
            snapshotId, "51A12345", clock.Now, clock.Now.AddMinutes(5), 5000);
        var token = tokens.SignQuote(proof);

        var repo = new AuthTestRepo(lotId, new CheckOutQuoteResultDto(
            sessionId, null, slotId, "A01", "51A12345", "51A12345", true,
            clock.Now.AddHours(-1), clock.Now, clock.Now, 60, 0, 0, 5000, 5000, true,
            null, token, proof.ExpiresAt, snapshotId, vehicleId));

        var payments = new AuthTestPayments { ExceptionToThrow = new InvalidOperationException("Transient payment error") };
        var handler = new AuthorizeCheckOutCommandHandler(repo, new AuthTestAccess(), tokens, payments);
        var request = new ConfirmCheckOutRequestDto(sessionId, gateId, "CASH", 5000,
            DetectedPlate: "51A12345", QuoteToken: token);

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            handler.Handle(new AuthorizeCheckOutCommand(actorId, request, "auth-key-2"), CancellationToken.None));

        Assert.True(repo.ClaimCalled);
        Assert.True(repo.ReleaseCalled);
    }

    private sealed class AuthTestAccess : IFacilityAccess
    {
        public Task RequireAsync(Guid userId, Guid lotId, string capability, CancellationToken ct) => Task.CompletedTask;
    }

    private sealed class AuthTestPayments : ICheckOutPayments
    {
        public Exception? ExceptionToThrow { get; init; }
        public Task<decimal> GetCreditAsync(Guid actorId, Guid sessionId, Guid lotId, CancellationToken ct) => Task.FromResult(0m);
        public Task<CheckOutPaymentEvidence> SettleAsync(CheckOutProof proof, ConfirmCheckOutRequestDto request, CancellationToken ct)
            => ExceptionToThrow is not null ? throw ExceptionToThrow : Task.FromResult(new CheckOutPaymentEvidence(Guid.NewGuid(), proof.SessionId, proof.LotId, proof.GrossAmount, "VND", request.PaymentMethod));
    }

    private sealed class AuthTestRepo(Guid lotId, CheckOutQuoteResultDto quote) : IParkingRepository
    {
        public bool MismatchRecorded { get; private set; }
        public bool ClaimCalled { get; private set; }
        public bool ReleaseCalled { get; private set; }

        public Task<Guid?> GetSessionLotIdAsync(Guid sessionId, CancellationToken ct) => Task.FromResult<Guid?>(lotId);
        public Task<AuthorizeCheckOutResultDto?> GetCheckOutAuthorizationReplayAsync(Guid actorId, ConfirmCheckOutRequestDto request, string key, CancellationToken ct)
            => Task.FromResult<AuthorizeCheckOutResultDto?>(null);
        public Task RecordCheckOutMismatchAsync(Guid sessionId, Guid actorId, string observedPlate, CancellationToken ct)
        {
            MismatchRecorded = true;
            return Task.CompletedTask;
        }
        public Task<CheckOutQuoteResultDto> GetCheckOutQuoteAsync(Guid lot, Guid gateId, string detectedPlate, string? qrPayload, CancellationToken ct, Guid? sessionId = null)
            => Task.FromResult(quote);
        public Task<AuthorizeCheckOutResultDto?> ClaimCheckOutAuthorizationAsync(Guid actorId, ConfirmCheckOutRequestDto request, string key, CancellationToken ct)
        {
            ClaimCalled = true;
            return Task.FromResult<AuthorizeCheckOutResultDto?>(null);
        }
        public Task ReleaseCheckOutAuthorizationClaimAsync(Guid actorId, string key, CancellationToken ct)
        {
            ReleaseCalled = true;
            return Task.CompletedTask;
        }

        public Task<AuthorizeCheckOutResultDto> SaveCheckOutAuthorizationAsync(Guid actorId, ConfirmCheckOutRequestDto request, string key, AuthorizeCheckOutResultDto result, CancellationToken ct) => throw new NotImplementedException();
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
        public Task<ConfirmCheckOutResultDto?> GetCheckOutReplayAsync(Guid actorId, ConfirmCheckOutRequestDto request, string key, CancellationToken ct) => throw new NotImplementedException();
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
