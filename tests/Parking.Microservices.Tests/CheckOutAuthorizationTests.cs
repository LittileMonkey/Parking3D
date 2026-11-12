using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Parking.Identity.Persistence.DataAccessLayer;
using Parking.Identity.Persistence.Repositories;
using Parking.Parking.Application;
using Parking.Parking.Application.DTOs;
using Parking.Parking.Application.Exceptions;
using Parking.Parking.Application.Features.CheckOut.Commands;
using Parking.Parking.Application.Features.CheckOut.Queries;
using Parking.Parking.Application.Interfaces;
using Parking.Parking.Infrastructure.Services;
using Microsoft.Extensions.Configuration;
using Parking.ServiceDefaults;
using Xunit;

namespace Parking.Microservices.Tests;

public sealed partial class ParkingWorkflowTests
{
    [PostgresFact]
    public async Task CheckOutAuthorizationCustomerCannotCloseSession()
    {
        var request = await PrepareAuthorizedCheckOut();
        await using var identity = CheckOutIdentityContext();
        var access = new CheckOutIdentityAccess(new AssignedLotRepository(identity));
        using var services = CheckOutServices(access);
        var handler = ActivatorUtilities.CreateInstance<ConfirmCheckOutCommandHandler>(services);

        var error = await Assert.ThrowsAsync<ServiceException>(() => handler.Handle(
            new ConfirmCheckOutCommand(Customer, request, "customer-exit"), Ct));

        Assert.Equal(403, error.StatusCode);
        await AssertCheckOutNotWritten();
    }

    [PostgresFact]
    public async Task CheckOutAuthorizationStaffAtAnotherLotCannotCloseSession()
    {
        var request = await PrepareAuthorizedCheckOut();
        await using var identity = CheckOutIdentityContext();
        await identity.Database.ExecuteSqlInterpolatedAsync(
            $"UPDATE lot_staff_assignments SET lot_id={Guid.NewGuid()}");
        var access = new CheckOutIdentityAccess(new AssignedLotRepository(identity));
        using var services = CheckOutServices(access);
        var handler = ActivatorUtilities.CreateInstance<ConfirmCheckOutCommandHandler>(services);

        var error = await Assert.ThrowsAsync<ServiceException>(() => handler.Handle(
            new ConfirmCheckOutCommand(Staff, request, "wrong-lot-exit"), Ct));

        Assert.Equal(403, error.StatusCode);
        await AssertCheckOutNotWritten();
    }

    [PostgresFact]
    public async Task CheckOutAuthorizationLockedStaffCannotCloseSession()
    {
        var request = await PrepareAuthorizedCheckOut();
        await using var identity = CheckOutIdentityContext();
        await identity.Database.ExecuteSqlInterpolatedAsync(
            $"UPDATE app_users SET locked_until=now()+interval '1 hour' WHERE id={Staff}");
        var access = new CheckOutIdentityAccess(new AssignedLotRepository(identity));
        using var services = CheckOutServices(access);
        var handler = ActivatorUtilities.CreateInstance<ConfirmCheckOutCommandHandler>(services);

        var error = await Assert.ThrowsAsync<ServiceException>(() => handler.Handle(
            new ConfirmCheckOutCommand(Staff, request, "locked-exit"), Ct));

        Assert.Equal(403, error.StatusCode);
        await AssertCheckOutNotWritten();
    }

    [PostgresFact]
    public Task CheckOutAuthorizationAssignedStaffCanCloseAndReplay()
        => AssertCheckOutAllowedAndReplay(false);

    [PostgresFact]
    public Task CheckOutAuthorizationAssignedManagerCanCloseAndReplay()
        => AssertCheckOutAllowedAndReplay(true);

    private async Task AssertCheckOutAllowedAndReplay(bool manager)
    {
        var request = await PrepareAuthorizedCheckOut();
        await using var identity = CheckOutIdentityContext();
        if (manager)
            await identity.Database.ExecuteSqlRawAsync(
                "UPDATE lot_staff_assignments SET role_code='PARKING_MANAGER'");
        var access = new CheckOutIdentityAccess(new AssignedLotRepository(identity));
        using var services = CheckOutServices(access);
        var handler = ActivatorUtilities.CreateInstance<ConfirmCheckOutCommandHandler>(services);
        var command = new ConfirmCheckOutCommand(Staff, request, "authorized-exit");

        var first = await handler.Handle(command, Ct);
        Assert.Equal(Lot, await repository.GetSessionLotIdAsync(request.SessionId, Ct));
        Assert.Equal(first, await handler.Handle(command, Ct));
        Assert.Equal(2, access.Calls);
        Assert.Equal("COMPLETED", await Scalar("SELECT status::text FROM parking_sessions"));
        Assert.Equal(1L, await Scalar("SELECT count(*) FROM audit_logs WHERE action='CHECK_OUT'"));

        // Losing the assignment must also block retrieval of an old successful outcome.
        await identity.Database.ExecuteSqlRawAsync("UPDATE lot_staff_assignments SET revoked_at=now()");
        var error = await Assert.ThrowsAsync<ServiceException>(() => handler.Handle(command, Ct));
        Assert.Equal(403, error.StatusCode);
        Assert.Equal(1L, await Scalar("SELECT count(*) FROM audit_logs WHERE action='CHECK_OUT'"));
    }

    [PostgresFact]
    public async Task CheckOutAuthorizationServiceFailureCannotCloseSession()
    {
        var request = await PrepareAuthorizedCheckOut();
        using var services = CheckOutServices(new UnavailableCheckOutAccess());
        var handler = ActivatorUtilities.CreateInstance<ConfirmCheckOutCommandHandler>(services);

        var error = await Assert.ThrowsAsync<ServiceException>(() => handler.Handle(
            new ConfirmCheckOutCommand(Staff, request, "unverified-exit"), Ct));

        Assert.Equal(503, error.StatusCode);
        await AssertCheckOutNotWritten();
    }

    [PostgresFact]
    public async Task CheckOutAuthorizationMissingSessionReturnsNotFound()
    {
        var request = new ConfirmCheckOutRequestDto(Guid.NewGuid(), Guid.NewGuid(), "NONE");
        Assert.Null(await repository.GetSessionLotIdAsync(request.SessionId, Ct));
        using var services = CheckOutServices(new UnavailableCheckOutAccess());
        var handler = ActivatorUtilities.CreateInstance<ConfirmCheckOutCommandHandler>(services);

        await Assert.ThrowsAsync<NotFoundException>(() => handler.Handle(
            new ConfirmCheckOutCommand(Staff, request, "missing-exit"), Ct));
    }

    [PostgresFact]
    public async Task CheckOutAuthorizationEntryGateCannotQuoteOrConfirmExit()
    {
        var request = await PrepareAuthorizedCheckOut();

        var quoteError = await Assert.ThrowsAsync<ServiceException>(() =>
            repository.GetCheckOutQuoteAsync(Lot, Gate, "51A12345", null, Ct));
        Assert.Equal(400, quoteError.StatusCode);

        // Direct confirmation must also reject ENTRY even if the caller skips quote.
        var verification = VerificationFor(request);
        var confirmError = await Assert.ThrowsAsync<ServiceException>(() =>
            repository.CompleteCheckOutAsync(Staff, request with { GateId = Gate }, "entry-gate-exit", Ct,
                verification with { Proof=verification.Proof with { GateId=Gate } }));
        Assert.Equal(409, confirmError.StatusCode);
        await AssertCheckOutNotWritten();
    }

    [PostgresFact]
    public async Task CheckOutAuthorizationBothGateAllowsQuoteAndConfirmExit()
    {
        var request = await PrepareAuthorizedCheckOut();
        await Sql("UPDATE lot_gates SET gate_kind='BOTH' WHERE id=@gate", ("gate", request.GateId));

        var quote = await repository.GetCheckOutQuoteAsync(Lot, request.GateId, "51A12345", null, Ct);
        Assert.Equal(request.SessionId, quote.SessionId);
        Assert.True(quote.IsPlateMatched);

        var result = await repository.CompleteCheckOutAsync(Staff, request, "both-gate-exit", Ct, VerificationFor(request));
        Assert.Equal(request.SessionId, result.SessionId);
        Assert.Equal("AVAILABLE", result.SlotStatus);
        Assert.Equal("COMPLETED", await Scalar("SELECT status::text FROM parking_sessions"));
        Assert.Equal(0L, await Scalar("SELECT count(*) FROM session_slot_assignments WHERE vacated_at IS NULL"));
    }

    private async Task<ConfirmCheckOutRequestDto> PrepareAuthorizedCheckOut()
    {
        var session = await Enter(await ConfirmAndIssue(await Book()));
        var exitGate = Guid.NewGuid();
        await Sql("INSERT INTO lot_gates(id,lot_id,code,gate_kind) VALUES(@gate,@lot,'EXIT-AUTH','EXIT')",
            ("gate", exitGate), ("lot", Lot));
        Assert.Equal(Lot, await repository.GetSessionLotIdAsync(session.SessionId, Ct));
        var quote=await repository.GetCheckOutQuoteAsync(Lot,exitGate,"51A12345",null,Ct,session.SessionId);
        var proof=new CheckOutProof(Guid.NewGuid(),Staff,session.SessionId,Lot,exitGate,quote.SlotId,quote.VehicleId,
            quote.PricingSnapshotId,quote.ExitPlate,quote.QuoteAt,quote.QuoteAt.AddMinutes(5),quote.TotalAmountDue);
        return new ConfirmCheckOutRequestDto(session.SessionId, exitGate, "NONE",DetectedPlate:"51A12345",
            QuoteToken:CheckOutTestTokens().SignQuote(proof),StaffObservedExit:true,
            ExitPermitToken:CheckOutTestTokens().SignExitPermit(new(proof,new(null,session.SessionId,Lot,0,"VND","NONE"))));
    }

    [PostgresFact]
    public async Task CheckOutAuthorizeExitKeepsSlotOccupiedUntilStaffConfirmsPhysicalExit()
    {
        var request=await PrepareAuthorizedCheckOut();
        await using var identity=CheckOutIdentityContext();
        using var services=CheckOutServices(new CheckOutIdentityAccess(new AssignedLotRepository(identity)));
        var authorize=ActivatorUtilities.CreateInstance<AuthorizeCheckOutCommandHandler>(services);
        var allowed=await authorize.Handle(new(Staff,request with {StaffObservedExit=false,ExitPermitToken=""},"permit"),Ct);
        Assert.Equal("MANUAL_OPEN_AUTHORIZED",allowed.BarrierStatus);
        Assert.Equal("OCCUPIED",allowed.SlotStatus);
        Assert.Equal(allowed,await authorize.Handle(new(Staff,request with {StaffObservedExit=false,ExitPermitToken=""},"permit"),Ct));
        Assert.Equal(1L,await Scalar("SELECT count(*) FROM audit_logs WHERE action='AUTHORIZE_CHECK_OUT'"));
        await Assert.ThrowsAsync<ServiceException>(()=>authorize.Handle(new(Staff,request with {StaffNotes="Changed"},"permit"),Ct));
        await AssertCheckOutNotWritten();
        var confirm=ActivatorUtilities.CreateInstance<ConfirmCheckOutCommandHandler>(services);
        await Assert.ThrowsAsync<ServiceException>(()=>confirm.Handle(new(Staff,request with {ExitPermitToken=""},"missing-permit"),Ct));
        var result=await confirm.Handle(new(Staff,request with {ExitPermitToken=allowed.ExitPermitToken},"physical-exit"),Ct);
        Assert.Equal("AVAILABLE",result.SlotStatus);
    }

    [PostgresFact]
    public async Task CheckOutExitQrIdentifiesSessionButDoesNotBypassObservedPlate()
    {
        var request=await PrepareAuthorizedCheckOut();
        await using var identity=CheckOutIdentityContext();
        using var services=CheckOutServices(new CheckOutIdentityAccess(new AssignedLotRepository(identity)));
        var handler=ActivatorUtilities.CreateInstance<GetCheckOutQuoteQueryHandler>(services);
        var ticket=CheckOutTestTokens().IssueExitQr(request.SessionId,Lot);
        var qrOnly=await handler.Handle(new(Staff,new(Lot,request.GateId,"",ticket.QrPayload)),Ct);
        Assert.Equal(request.SessionId,qrOnly.SessionId);
        Assert.False(qrOnly.IsPlateMatched);
        Assert.Null(qrOnly.QuoteToken);
        var wrong=await handler.Handle(new(Staff,new(Lot,request.GateId,"51A00000",ticket.QrPayload)),Ct);
        Assert.Equal("INCIDENT_0482_PLATE_MISMATCH",wrong.IncidentCode);
        Assert.Null(wrong.QuoteToken);
        var valid=await handler.Handle(new(Staff,new(Lot,request.GateId,"51A-123.45",ticket.QrPayload)),Ct);
        Assert.True(valid.IsPlateMatched);
        Assert.NotNull(valid.QuoteToken);
        await AssertCheckOutNotWritten();
    }

    [PostgresFact]
    public async Task CheckOutWrongPlateIsBlockedAndAuditedBeforePayment()
    {
        var request=await PrepareAuthorizedCheckOut();
        await using var identity=CheckOutIdentityContext();
        using var services=CheckOutServices(new CheckOutIdentityAccess(new AssignedLotRepository(identity)));
        var handler=ActivatorUtilities.CreateInstance<ConfirmCheckOutCommandHandler>(services);
        await Assert.ThrowsAsync<ConflictException>(()=>handler.Handle(new(Staff,request with {DetectedPlate="51A00000"},"wrong-plate"),Ct));
        await AssertCheckOutNotWritten();
        Assert.Equal(1L,await Scalar("SELECT count(*) FROM audit_logs WHERE action='CHECK_OUT_PLATE_MISMATCH'"));
    }

    [PostgresFact]
    public async Task CheckOutMissingQuoteAndPhysicalConfirmationAreBlocked()
    {
        var request=await PrepareAuthorizedCheckOut();
        await using var identity=CheckOutIdentityContext();
        using var services=CheckOutServices(new CheckOutIdentityAccess(new AssignedLotRepository(identity)));
        var handler=ActivatorUtilities.CreateInstance<ConfirmCheckOutCommandHandler>(services);
        await Assert.ThrowsAsync<ServiceException>(()=>handler.Handle(new(Staff,request with {QuoteToken=""},"missing-quote"),Ct));
        await Assert.ThrowsAsync<ConflictException>(()=>handler.Handle(new(Staff,request with {StaffObservedExit=false},"not-exited"),Ct));
        await AssertCheckOutNotWritten();
    }

    [PostgresFact]
    public async Task CheckOutEightConcurrentRetriesHaveOneEffectAndFreeTheReservation()
    {
        var request=await PrepareAuthorizedCheckOut();var verified=VerificationFor(request);
        var results=await Task.WhenAll(Enumerable.Range(0,8).Select(_=>repository.CompleteCheckOutAsync(Staff,request,"concurrent",Ct,verified)));
        Assert.All(results,item=>Assert.Equal(results[0],item));
        Assert.Equal(1L,await Scalar("SELECT count(*) FROM audit_logs WHERE action='CHECK_OUT'"));
        Assert.Equal(1L,await Scalar("SELECT count(*) FROM integration_outbox WHERE event_type='SlotStatusChanged.v1' AND payload->>'status'='AVAILABLE'"));
        Assert.Equal("RELEASED",await Scalar("SELECT status::text FROM slot_reservations"));
        await Assert.ThrowsAsync<ServiceException>(()=>repository.CompleteCheckOutAsync(Staff,request with {StaffNotes="different"},"concurrent",Ct,verified));
        var next=await Book();
        Assert.Equal("PENDING_PAYMENT",next.Status);
    }

    [PostgresFact]
    public async Task CheckOutEightDifferentKeysHaveOnlyOneSuccessfulExit()
    {
        var request=await PrepareAuthorizedCheckOut();var verified=VerificationFor(request);
        async Task<bool> Exit(int index)
        {
            try{await repository.CompleteCheckOutAsync(Staff,request,"exit-"+index,Ct,verified);return true;}
            catch(ServiceException error)when(error.StatusCode==409){return false;}
        }
        var results=await Task.WhenAll(Enumerable.Range(0,8).Select(Exit));
        Assert.Single(results,success=>success);
        Assert.Equal(1L,await Scalar("SELECT count(*) FROM audit_logs WHERE action='CHECK_OUT'"));
    }

    [PostgresFact]
    public async Task CheckOutAuditFailureRollsBackSessionAssignmentReservationAndEvent()
    {
        var request=await PrepareAuthorizedCheckOut();
        var reservationBefore=await Scalar("SELECT status::text FROM slot_reservations");
        await Sql("""
            CREATE FUNCTION fail_checkout_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
                IF NEW.action='CHECK_OUT' THEN RAISE EXCEPTION 'Test audit failure'; END IF;RETURN NEW;END $$;
            CREATE TRIGGER fail_checkout BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION fail_checkout_audit();
            """);
        await Assert.ThrowsAsync<global::Npgsql.PostgresException>(()=>repository.CompleteCheckOutAsync(Staff,request,"rollback",Ct,VerificationFor(request)));
        await AssertCheckOutNotWritten();
        Assert.Equal(reservationBefore,await Scalar("SELECT status::text FROM slot_reservations"));
        Assert.Equal(0L,await Scalar("SELECT count(*) FROM integration_outbox WHERE event_type='SlotStatusChanged.v1' AND payload->>'status'='AVAILABLE'"));
    }

    [PostgresFact]
    public async Task CheckOutCrossingFeeBlockRequiresNewQuoteWithoutReleasingSlot()
    {
        var request=await PrepareAuthorizedCheckOut();
        var clock=UseHoldTestClock();
        var expected=new DateTimeOffset((DateTime)(await Scalar("SELECT expected_exit_at FROM parking_sessions"))!);
        clock.UtcNow=expected.AddSeconds(899);
        var quote=await repository.GetCheckOutQuoteAsync(Lot,request.GateId,"51A12345",null,Ct,request.SessionId);
        Assert.Equal(7500m,quote.TotalAmountDue);
        var proof=new CheckOutProof(Guid.NewGuid(),Staff,request.SessionId,Lot,request.GateId,quote.SlotId,quote.VehicleId,
            quote.PricingSnapshotId,quote.ExitPlate,quote.QuoteAt,quote.QuoteAt.AddMinutes(5),quote.TotalAmountDue);
        clock.UtcNow=clock.UtcNow.AddSeconds(2);
        var evidence=new CheckOutPaymentEvidence(Guid.NewGuid(),request.SessionId,Lot,7500,"VND","CASH");
        var error=await Assert.ThrowsAsync<ServiceException>(()=>repository.CompleteCheckOutAsync(Staff,request,"block-boundary",Ct,new(proof,evidence)));
        Assert.Equal(409,error.StatusCode);
        await AssertCheckOutNotWritten();
    }

    private ParkingDatabaseV4Context CheckOutIdentityContext()
        => new(new DbContextOptionsBuilder<ParkingDatabaseV4Context>().UseNpgsql(identityConnection).Options);

    private ServiceProvider CheckOutServices(IFacilityAccess access)
        => new ServiceCollection().AddSingleton<IParkingRepository>(repository)
            .AddSingleton(access).AddSingleton<ICheckOutTokens>(CheckOutTestTokens())
            .AddSingleton<ICheckOutPayments,FreeCheckOutPayments>().BuildServiceProvider();

    private static CheckOutTokens CheckOutTestTokens()=>new(new ConfigurationBuilder().AddInMemoryCollection(
        new Dictionary<string,string?>{["Qr:SigningKey"]=new string('x',64)}).Build(),TimeProvider.System);

    private static CheckOutVerification VerificationFor(ConfirmCheckOutRequestDto request)
    {
        var proof=CheckOutTestTokens().ValidateQuote(request.QuoteToken);
        return new(proof,new(null,proof.SessionId,proof.LotId,0,"VND","NONE"));
    }

    private sealed class FreeCheckOutPayments : ICheckOutPayments
    {
        public Task<decimal> GetCreditAsync(Guid actorId,Guid sessionId,Guid lotId,CancellationToken ct)=>Task.FromResult(0m);
        public Task<CheckOutPaymentEvidence> SettleAsync(CheckOutProof proof,ConfirmCheckOutRequestDto request,CancellationToken ct)
            =>throw new InvalidOperationException("No remote payment call is expected for an in-hours prepaid checkout.");
    }

    private async Task AssertCheckOutNotWritten()
    {
        Assert.Equal("ACTIVE", await Scalar("SELECT status::text FROM parking_sessions"));
        Assert.Equal(1L, await Scalar("SELECT count(*) FROM session_slot_assignments WHERE vacated_at IS NULL"));
        Assert.Equal(0L, await Scalar("SELECT count(*) FROM audit_logs WHERE action='CHECK_OUT'"));
        Assert.Equal(0L, await Scalar("SELECT count(*) FROM integration_inbox WHERE event_type='CheckOutRequest'"));
    }

    // Uses real Identity authorization rules and its isolated database; transport is covered separately.
    private sealed class CheckOutIdentityAccess(AssignedLotRepository assignments) : IFacilityAccess
    {
        public int Calls { get; private set; }

        public async Task RequireAsync(Guid userId, Guid lotId, string capability, CancellationToken ct)
        {
            Calls++;
            Assert.Equal("GATE", capability);
            Assert.Equal(Lot, lotId);
            if (!await assignments.CheckAccessAsync(userId, lotId, capability, ct))
                throw new ServiceException(403, "Current account/lot permission denied");
        }
    }

    private sealed class UnavailableCheckOutAccess : IFacilityAccess
    {
        public Task RequireAsync(Guid userId, Guid lotId, string capability, CancellationToken ct)
            => throw new ServiceException(503, "Authorization service is unavailable. Please try again.");
    }
}
