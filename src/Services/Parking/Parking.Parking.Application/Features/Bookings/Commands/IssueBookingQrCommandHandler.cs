using MediatR;
using Parking.Parking.Application.DTOs;
using Parking.Parking.Application.Exceptions;
using Parking.Parking.Application.Interfaces;

namespace Parking.Parking.Application.Features.Bookings.Commands;

public sealed class IssueBookingQrCommandHandler(
    IParkingRepository repository,
    IQrTokenService qrTokenService,
    IFacilityAccess facilityAccess,
    TimeProvider clock)
    : IRequestHandler<IssueBookingQrCommand, BookingQrDto>
{
    public async Task<BookingQrDto> Handle(
        IssueBookingQrCommand request,
        CancellationToken cancellationToken)
    {
        await facilityAccess.RequireAsync(request.RequestingUserId, Guid.Empty, "USER", cancellationToken);

        // 1. Đọc thông tin booking.
        var booking = await repository.GetBookingQrContextAsync(
            request.BookingId,
            cancellationToken);

        if (booking is null)
        {
            throw new NotFoundException(
                "Không tìm thấy booking.");
        }

        // 2. Chủ booking được lấy QR.
        // Người khác phải có quyền tại đúng bãi.
        if (booking.CustomerId != request.RequestingUserId)
        {
            await facilityAccess.RequireAsync(
                request.RequestingUserId,
                booking.LotId,
                "LOOKUP",
                cancellationToken);
        }

        // 3. Chỉ cấp QR sau khi booking được xác nhận.
        if (booking.Status != "CONFIRMED")
        {
            throw new ConflictException(
                "Chỉ booking CONFIRMED mới được cấp QR.");
        }

        // 4. Không cấp QR khi đã quá hạn đến check-in.
        if (booking.ArrivalDeadline <= clock.GetUtcNow())
        {
            throw new ConflictException(
                "Booking đã quá hạn đến check-in.");
        }

        // 5. Tạo token gắn với booking, bãi và xe.
        var token = qrTokenService.GenerateToken(
            booking.BookingId,
            booking.LotId,
            booking.VehicleId,
            booking.ArrivalDeadline);

        // 6. Repository kiểm tra lại dưới khóa và lưu nguyên tử.
        await repository.SaveIssuedQrTokenAsync(
            booking.BookingId,
            booking.LotId,
            booking.VehicleId,
            token,
            cancellationToken);

        // 7. Chỉ trả token sau khi lưu thành công.
        return new BookingQrDto(
            booking.BookingId,
            booking.BookingCode,
            token.QrPayload,
            token.ExpiresAt);
    }
}
