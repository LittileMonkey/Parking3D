using MediatR;
using Parking.Parking.Application.DTOs;
using Parking.Parking.Application.Exceptions;
using Parking.Parking.Application.Interfaces;

namespace Parking.Parking.Application.Features.Bookings.Commands;

// Điều phối quyền và QR; repository xử lý transaction chống quét trùng.
public sealed class CheckInCommandHandler(
    IParkingRepository repository, IQrTokenService qrTokens, IFacilityAccess access)
    : IRequestHandler<CheckInCommand, CheckInResponseDto>
{
    /// <summary>Hỏi Identity quyền CHECK_IN và xác minh QR trước khi gọi transaction tạo phiên một lần.</summary>
    public async Task<CheckInResponseDto> Handle(CheckInCommand command, CancellationToken ct)
    {
        // Hỏi Identity trước khi giữ khóa DB, tránh chờ mạng trong transaction.
        await access.RequireAsync(command.ActorId, command.Request.LotId, "CHECK_IN", ct);
        if (!qrTokens.TryValidateAndExtract(command.Request.QrPayload, out var token) || token is null)
            throw new ConflictException("QR is invalid or expired.");
        if (token.LotId != command.Request.LotId)
            throw new ConflictException("QR does not belong to the requested parking lot.");
        return await repository.CheckInAsync(command.ActorId, command.Request, token, command.IdempotencyKey, ct);
    }
}
