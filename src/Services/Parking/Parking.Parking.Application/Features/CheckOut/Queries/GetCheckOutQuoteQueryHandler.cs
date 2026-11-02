using MediatR;
using Parking.Parking.Application.DTOs;
using Parking.Parking.Application.Interfaces;
using Parking.Parking.Application.Exceptions;

namespace Parking.Parking.Application.Features.CheckOut.Queries;

/// <summary>
/// Handler điều phối xác thực quyền bãi đỗ và tra cứu cước phí xuất bãi.
/// </summary>
public sealed class GetCheckOutQuoteQueryHandler(
    IParkingRepository repository,
    IFacilityAccess access,
    ICheckOutTokens tokens,
    ICheckOutPayments payments)
    : IRequestHandler<GetCheckOutQuoteQuery, CheckOutQuoteResultDto>
{
    public async Task<CheckOutQuoteResultDto> Handle(GetCheckOutQuoteQuery query, CancellationToken ct)
    {
        await access.RequireAsync(query.ActorId, query.Request.LotId, "GATE", ct);
        var sessionId = query.Request.SessionId;
        if (!string.IsNullOrWhiteSpace(query.Request.QrPayload))
        {
            var claim = tokens.ValidateExitQr(query.Request.QrPayload);
            if (claim.LotId != query.Request.LotId || (sessionId.HasValue && sessionId != claim.SessionId))
                throw new ConflictException("Exit QR does not match this lot/session.");
            sessionId = claim.SessionId;
        }
        var quote = await repository.GetCheckOutQuoteAsync(
            query.Request.LotId,
            query.Request.GateId,
            query.Request.DetectedPlate,
            null, ct, sessionId);
        if (!quote.IsPlateMatched)
        {
            if (!string.IsNullOrWhiteSpace(query.Request.DetectedPlate))
                await repository.RecordCheckOutMismatchAsync(quote.SessionId, query.ActorId, query.Request.DetectedPlate, ct);
            return quote;
        }
        var credit = quote.TotalAmountDue > 0
            ? await payments.GetCreditAsync(query.ActorId, quote.SessionId, query.Request.LotId, ct) : 0;
        var expires = quote.QuoteAt.AddMinutes(5);
        var proof = new CheckOutProof(Guid.NewGuid(), query.ActorId, quote.SessionId, query.Request.LotId,
            query.Request.GateId, quote.SlotId, quote.VehicleId, quote.PricingSnapshotId, quote.ExitPlate,
            quote.QuoteAt, expires, quote.TotalAmountDue);
        var due = Math.Max(0, quote.TotalAmountDue - credit);
        return quote with { QuoteToken = tokens.SignQuote(proof), ValidUntil = expires,
            TotalAmountDue = due, PaymentRequired = due > 0, CheckoutCredit = credit };
    }
}
