using MediatR;
using Parking.Parking.Application.DTOs;
using Parking.Parking.Application.Exceptions;

namespace Parking.Parking.Application.Features.Bookings.Queries;

// Xử lý truy vấn chi tiết đơn đặt chỗ và kiểm tra quyền sở hữu hoặc quyền nhân viên bãi
public class GetBookingDetailQueryHandler : IRequestHandler<GetBookingDetailQuery, BookingDetailDto>
{
    private readonly IParkingRepository _repository;

    public GetBookingDetailQueryHandler(IParkingRepository repository)
    {
        _repository = repository;
    }

    public async Task<BookingDetailDto> Handle(GetBookingDetailQuery request, CancellationToken cancellationToken)
    {
        // 1. Lấy dữ liệu booking từ repository
        var record = await _repository.GetBookingDetailAsync(request.BookingId, cancellationToken);
        if (record is null)
        {
            throw new NotFoundException("Booking not found");
        }

        var (detail, customerId, lotId) = record.Value;

        // 2. Kiểm tra phân quyền: Khách sở hữu đơn hoặc Nhân viên được gán bãi đó
        bool isOwner = customerId.HasValue && customerId.Value == request.RequestingUserId;
        if (!isOwner)
        {
            var isStaff = await _repository.IsStaffAssignedAsync(lotId, request.RequestingUserId, cancellationToken);
            if (!isStaff)
            {
                throw new ForbiddenAccessException("Forbidden: Resource ownership or facility scope violation");
            }
        }

        return detail;
    }
}
