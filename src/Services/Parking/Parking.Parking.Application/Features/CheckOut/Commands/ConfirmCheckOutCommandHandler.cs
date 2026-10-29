using MediatR;
using Parking.Parking.Application.DTOs;
using Parking.Parking.Application.Interfaces;

namespace Parking.Parking.Application.Features.CheckOut.Commands;

/// <summary>
/// Handler điều phối xác nhận check-out, gọi repository hoàn tất giao dịch và mở barrier.
/// </summary>
public sealed class ConfirmCheckOutCommandHandler(IParkingRepository repository)
    : IRequestHandler<ConfirmCheckOutCommand, ConfirmCheckOutResultDto>
{
    public async Task<ConfirmCheckOutResultDto> Handle(ConfirmCheckOutCommand command, CancellationToken ct)
    {
        // Repository sẽ giữ khóa pg_advisory_xact_lock(slot_id), cập nhật session COMPLETED,
        // đóng assignment vacated_at, chuyển slot sang AVAILABLE và ghi audit log nguyên tử.
        return await repository.CompleteCheckOutAsync(
            command.ActorId,
            command.Request,
            command.IdempotencyKey,
            ct);
    }
}
