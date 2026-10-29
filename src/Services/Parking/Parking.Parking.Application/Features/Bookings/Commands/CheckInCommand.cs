using MediatR;
using Parking.Parking.Application.DTOs;

namespace Parking.Parking.Application.Features.Bookings.Commands;

// Actor lấy từ JWT; key dùng để gửi lại request mà không tạo thêm phiên gửi xe.
// Gói danh tính Staff, dữ liệu quét và khóa chống xử lý trùng cho Handler.
public sealed record CheckInCommand(Guid ActorId, CheckInRequestDto Request, string IdempotencyKey)
    : IRequest<CheckInResponseDto>;
