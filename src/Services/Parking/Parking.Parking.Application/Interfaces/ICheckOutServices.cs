using Parking.Parking.Application.DTOs;

namespace Parking.Parking.Application.Interfaces;

public interface ICheckOutTokens
{
    string SignQuote(CheckOutProof proof);
    CheckOutProof ValidateQuote(string token);
    string SignExitPermit(CheckOutVerification verification);
    CheckOutVerification ValidateExitPermit(string token);
    CheckOutQrDto IssueExitQr(Guid sessionId, Guid lotId);
    (Guid SessionId, Guid LotId) ValidateExitQr(string token);
}

public interface ICheckOutPayments
{
    Task<decimal> GetCreditAsync(Guid actorId, Guid sessionId, Guid lotId, CancellationToken ct);
    Task<CheckOutPaymentEvidence> SettleAsync(CheckOutProof proof,
        ConfirmCheckOutRequestDto request, CancellationToken ct);
}
