using MediatR;
using Parking.Parking.Application.DTOs;

namespace Parking.Parking.Application.Features.Bookings.Commands;

// Actor lấy từ JWT; key dùng để gửi lại request mà không tạo thêm phiên gửi xe.
public sealed record CheckInCommand(Guid ActorId, CheckInRequestDto Request, string IdempotencyKey)
    : IRequest<CheckInResponseDto>;
