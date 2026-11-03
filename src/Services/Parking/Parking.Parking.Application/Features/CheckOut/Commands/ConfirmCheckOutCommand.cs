using MediatR;
using Parking.Parking.Application.DTOs;

namespace Parking.Parking.Application.Features.CheckOut.Commands;

/// <summary>
/// Command xác nhận hoàn tất check-out, giải phóng ô đỗ và mở barrier cổng ra.
/// </summary>
public sealed record ConfirmCheckOutCommand(
    Guid ActorId,
    ConfirmCheckOutRequestDto Request,
    string IdempotencyKey) : IRequest<ConfirmCheckOutResultDto>;
