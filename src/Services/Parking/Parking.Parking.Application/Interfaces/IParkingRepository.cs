using Parking.Parking.Application.DTOs;
using Parking.Parking.Application.Interfaces;

namespace Parking.Parking.Application;

// Application phụ thuộc hợp đồng này; kết nối, SQL và transaction nằm ở Persistence.
public interface IParkingRepository
{
    /// <summary>Liệt kê các bãi đang hoạt động với dữ liệu công khai.</summary>
    Task<IReadOnlyList<LotView>> ListLotsAsync(CancellationToken ct);

    /// <summary>Kiểm tra bãi còn hoạt động trước khi gọi luồng nghiệp vụ liên quan.</summary>
    Task<bool> LotExistsAsync(Guid lotId, CancellationToken ct);

    /// <summary>Tạo booking và reservation HELD theo policy, có khóa và chống request trùng.</summary>
    Task<BookingView> CreateBookingAsync(
        Guid customerId, BookingRequest request, string key, CancellationToken ct);

    /// <summary>Tra cứu trạng thái ô theo khoảng thời gian và bộ lọc trong một snapshot nhất quán.</summary>
    Task<LotAvailabilityDto> GetLotAvailabilityAsync(
        Guid lotId,
        DateTimeOffset? startTime,
        DateTimeOffset? endTime,
        string? vehicleType,
        Guid? levelId,
        CancellationToken ct);

    /// <summary>Đọc booking kèm owner và bãi để Handler xác minh quyền trước khi trả DTO.</summary>
    Task<(BookingDetailDto Detail, Guid? CustomerId, Guid LotId)?> GetBookingDetailAsync(
        Guid bookingId, CancellationToken ct);

    /// <summary>Hết hạn hold chưa thanh toán; không giải phóng reservation xác nhận hay chỗ có xe.</summary>
    Task<int> ExpireHoldsAsync(CancellationToken ct);

    /// <summary>Đọc thông tin nội bộ cần cho kiểm tra quyền và điều kiện phát hành QR.</summary>
    Task<BookingQrContextDto?> GetBookingQrContextAsync(Guid bookingId, CancellationToken ct);

    /// <summary>Kiểm tra lại dưới khóa, thu hồi QR cũ và lưu hash nonce mới trong một transaction.</summary>
    Task SaveIssuedQrTokenAsync(
        Guid bookingId,
        Guid expectedLotId,
        Guid expectedVehicleId,
        GeneratedQrToken token,
        CancellationToken ct);

    /// <summary>Consume QR, tạo session và assignment, ghi audit và outcome chống trùng một cách nguyên tử.</summary>
    Task<CheckInResponseDto> CheckInAsync(
        Guid actorId,
        CheckInRequestDto request,
        ValidatedQrToken token,
        string key,
        CancellationToken ct);

    /// <summary>
    /// SCRUM-70: Tra cứu phiên đỗ ACTIVE theo biển số/QR, đối soát biển số và tính cước thực tế tại cổng ra.
    /// </summary>
    Task<CheckOutQuoteResultDto> GetCheckOutQuoteAsync(
        Guid lotId,
        Guid gateId,
        string detectedPlate,
        string? qrPayload,
        CancellationToken ct);

    /// <summary>
    /// SCRUM-70: Khóa slot_id, xác nhận thanh toán, đóng session COMPLETED, giải phóng slot và ghi audit nguyên tử.
    /// </summary>
    Task<ConfirmCheckOutResultDto> CompleteCheckOutAsync(
        Guid actorId,
        ConfirmCheckOutRequestDto request,
        string key,
        CancellationToken ct);
}

