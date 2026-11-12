using FluentValidation;
using MediatR;
using Parking.Parking.Application.DTOs;
using Parking.Parking.Application.Exceptions;
using Parking.Parking.Application.Interfaces;
using Parking.Parking.Domain;

namespace Parking.Parking.Application.Features.CheckOut.Commands;

public sealed record AuthorizeCheckOutCommand(Guid ActorId,ConfirmCheckOutRequestDto Request,string IdempotencyKey)
    : IRequest<AuthorizeCheckOutResultDto>;

public sealed class AuthorizeCheckOutCommandValidator : AbstractValidator<AuthorizeCheckOutCommand>
{
    public AuthorizeCheckOutCommandValidator()
    {
        // Authorization precedes physical exit; the remaining wire validations are identical.
        RuleFor(x=>ForValidation(x))
            .SetValidator(new ConfirmCheckOutCommandValidator());
    }
    private static ConfirmCheckOutCommand ForValidation(AuthorizeCheckOutCommand command)
        =>new(command.ActorId,command.Request with {StaffObservedExit=true,ExitPermitToken="pending"},command.IdempotencyKey);
}

public sealed class AuthorizeCheckOutCommandHandler(IParkingRepository repository,IFacilityAccess access,
    ICheckOutTokens tokens,ICheckOutPayments payments) : IRequestHandler<AuthorizeCheckOutCommand,AuthorizeCheckOutResultDto>
{
    public async Task<AuthorizeCheckOutResultDto> Handle(AuthorizeCheckOutCommand command,CancellationToken ct)
    {
        var lot=await repository.GetSessionLotIdAsync(command.Request.SessionId,ct)
            ?? throw new NotFoundException("Parking session not found.");
        await access.RequireAsync(command.ActorId,lot,"GATE",ct);
        var replay=await repository.GetCheckOutAuthorizationReplayAsync(command.ActorId,command.Request,command.IdempotencyKey,ct);
        if(replay is not null)return replay;

        var proof=tokens.ValidateQuote(command.Request.QuoteToken);
        if(proof.ActorId!=command.ActorId||proof.SessionId!=command.Request.SessionId||proof.LotId!=lot||proof.GateId!=command.Request.GateId)
            throw new ConflictException("Checkout quote belongs to another actor/session/gate.");
        if(!PlateNumber.TryNormalize(command.Request.DetectedPlate,out var plate)||plate!=proof.Plate)
        {
            await repository.RecordCheckOutMismatchAsync(proof.SessionId,command.ActorId,command.Request.DetectedPlate,ct);
            throw new ConflictException("INCIDENT_0482_PLATE_MISMATCH: exit authorization blocked.");
        }
        var current=await repository.GetCheckOutQuoteAsync(lot,proof.GateId,plate,null,ct,proof.SessionId);
        if(!current.IsPlateMatched||current.SlotId!=proof.SlotId||current.PricingSnapshotId!=proof.PricingSnapshotId||
            current.OvertimeAmount!=proof.GrossAmount)
            throw new ConflictException("Checkout context changed. Request a new quote.");

        // Claim idempotency only after all validations succeed so bad requests do not leave PENDING claims.
        var claimedReplay=await repository.ClaimCheckOutAuthorizationAsync(command.ActorId,command.Request,command.IdempotencyKey,ct);
        if(claimedReplay is not null)return claimedReplay;

        try
        {
            var payment=proof.GrossAmount==0&&command.Request.PaymentMethod=="NONE"
                ?new CheckOutPaymentEvidence(null,proof.SessionId,lot,0,"VND","NONE")
                :await payments.SettleAsync(proof,command.Request,ct);
            var verification=new CheckOutVerification(proof,payment);
            var permit=tokens.SignExitPermit(verification);
            // Validate the trusted payment reply before permitting the gate operator to act.
            tokens.ValidateExitPermit(permit);
            return await repository.SaveCheckOutAuthorizationAsync(command.ActorId,command.Request,command.IdempotencyKey,
                new(proof.SessionId,permit,proof.ExpiresAt,payment.AmountPaid,payment.PaymentId),ct);
        }
        catch
        {
            try { await repository.ReleaseCheckOutAuthorizationClaimAsync(command.ActorId,command.IdempotencyKey,CancellationToken.None); }
            catch { /* Best-effort cleanup of the in-flight PENDING claim so transient failures remain retryable. */ }
            throw;
        }
    }
}
