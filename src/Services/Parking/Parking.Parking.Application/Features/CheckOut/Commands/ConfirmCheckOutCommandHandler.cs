using MediatR;
using Parking.Parking.Application.DTOs;
using Parking.Parking.Application.Exceptions;
using Parking.Parking.Application.Interfaces;
using Parking.Parking.Domain;

namespace Parking.Parking.Application.Features.CheckOut.Commands;

/// <summary>
/// Handler điều phối xác nhận check-out, gọi repository hoàn tất giao dịch và mở barrier.
/// </summary>
public sealed class ConfirmCheckOutCommandHandler(
    IParkingRepository repository,
    IFacilityAccess access,
    ICheckOutTokens tokens,
    ICheckOutPayments payments)
    : IRequestHandler<ConfirmCheckOutCommand, ConfirmCheckOutResultDto>
{
    public async Task<ConfirmCheckOutResultDto> Handle(ConfirmCheckOutCommand command, CancellationToken ct)
    {
        // Lấy bãi từ session thật; xác minh quyền trước transaction và trước cả replay.
        var lotId = await repository.GetSessionLotIdAsync(command.Request.SessionId, ct)
            ?? throw new NotFoundException("Parking session not found.");

        await access.RequireAsync(command.ActorId, lotId, "GATE", ct);

        var replay = await repository.GetCheckOutReplayAsync(command.ActorId, command.Request, command.IdempotencyKey, ct);
        if (replay is not null) return replay;
        var proof = tokens.ValidateQuote(command.Request.QuoteToken);
        if (proof.ActorId != command.ActorId || proof.SessionId != command.Request.SessionId ||
            proof.LotId != lotId || proof.GateId != command.Request.GateId)
            throw new ConflictException("Checkout quote belongs to another actor/session/gate.");
        if (!command.Request.StaffObservedExit) throw new ConflictException("Physical exit must be confirmed by Staff.");
        if (!PlateNumber.TryNormalize(command.Request.DetectedPlate, out var plate) || plate != proof.Plate)
        {
            await repository.RecordCheckOutMismatchAsync(command.Request.SessionId, command.ActorId,
                command.Request.DetectedPlate, ct);
            throw new ConflictException("INCIDENT_0482_PLATE_MISMATCH: checkout blocked.");
        }
        var verification=tokens.ValidateExitPermit(command.Request.ExitPermitToken);
        if(verification.Proof!=proof)
            throw new ConflictException("Exit permit does not belong to this checkout quote.");
        if(proof.GrossAmount>0&&await payments.GetCreditAsync(command.ActorId,proof.SessionId,lotId,ct)<proof.GrossAmount)
            throw new ConflictException("Checkout payment is no longer sufficient. Request a new quote.");

        // Repository kiểm tra trạng thái dưới khóa và hoàn tất giao dịch chống trùng.
        return await repository.CompleteCheckOutAsync(
            command.ActorId,
            command.Request,
            command.IdempotencyKey,
            ct, verification);
    }
}
