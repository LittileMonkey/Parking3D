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
    /// SCRUM-69: Check-in tự động cho khách vãng lai (hoặc qua nhận diện ANPR):
    /// Thuật toán AUTO_SLOT tìm ô đỗ tối ưu (SKIP LOCKED), tạo phiên ParkingSession mới và gán slot vật lý.
    /// </summary>
    Task<CheckInResponseDto> CheckInWalkInAsync(
        Guid actorId,
        CheckInRequestDto request,
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
        CancellationToken ct,
        Guid? sessionId = null);

    Task<ConfirmCheckOutResultDto?> GetCheckOutReplayAsync(Guid actorId,
        ConfirmCheckOutRequestDto request, string key, CancellationToken ct);

    Task RecordCheckOutMismatchAsync(Guid sessionId, Guid actorId, string observedPlate, CancellationToken ct);
    Task<AuthorizeCheckOutResultDto?> ClaimCheckOutAuthorizationAsync(Guid actorId,
        ConfirmCheckOutRequestDto request,string key,CancellationToken ct);
    Task<AuthorizeCheckOutResultDto> SaveCheckOutAuthorizationAsync(Guid actorId,
        ConfirmCheckOutRequestDto request,string key,AuthorizeCheckOutResultDto result,CancellationToken ct);

    /// <summary>Đọc bãi của phiên ở mọi trạng thái để kiểm tra quyền, kể cả khi gửi lại checkout.</summary>
    Task<Guid?> GetSessionLotIdAsync(Guid sessionId, CancellationToken ct);

    /// <summary>
    /// SCRUM-70: Khóa slot_id, xác nhận thanh toán, đóng session COMPLETED, giải phóng slot và ghi audit nguyên tử.
    /// </summary>
    Task<ConfirmCheckOutResultDto> CompleteCheckOutAsync(
        Guid actorId,
        ConfirmCheckOutRequestDto request,
        string key,
        CancellationToken ct,
        CheckOutVerification? verification = null);

    // ==========================================
    // SCRUM-99: Incidents & Exceptions
    // ==========================================

    /// <summary>
    /// Ghi nhận báo cáo sự cố hoặc ngoại lệ mới tại bãi đỗ xe (Open).
    /// Hỗ trợ kiểm tra báo muộn (>10 phút cần lý do), chống gửi trùng qua Idempotency-Key và khóa giao dịch.
    /// </summary>
    Task<IncidentDto> CreateIncidentAsync(
        Guid lotId,
        Guid actorId,
        CreateIncidentRequestDto request,
        string? key,
        CancellationToken ct);

    /// <summary>
    /// Liệt kê danh sách sự cố tại bãi đỗ xe theo bộ lọc trạng thái, mức độ nghiêm trọng, tìm kiếm và phân trang.
    /// </summary>
    Task<PagedResult<IncidentSummaryDto>> ListIncidentsAsync(
        Guid lotId,
        string? status,
        string? severity,
        string? query,
        int page,
        int pageSize,
        CancellationToken ct);

    /// <summary>
    /// Lấy chi tiết thông tin một sự cố tại bãi đỗ xe kèm chứng cứ và quyết định xử lý ngoại lệ (nếu có).
    /// </summary>
    Task<IncidentDto?> GetIncidentByIdAsync(
        Guid lotId,
        Guid incidentId,
        CancellationToken ct);

    /// <summary>
    /// Cập nhật tiến độ xử lý sự cố (InProgress/Escalated/Resolved) có kiểm soát xung đột phiên bản (Optimistic Concurrency).
    /// </summary>
    Task<IncidentDto> UpdateIncidentStatusAsync(
        Guid lotId,
        Guid incidentId,
        Guid actorId,
        UpdateIncidentStatusRequestDto request,
        CancellationToken ct);

    /// <summary>
    /// Lấy lịch sử các hành động thay đổi trạng thái của sự cố mà không để lộ nhật ký audit thô.
    /// </summary>
    Task<PagedResult<IncidentHistoryItemDto>> GetIncidentHistoryAsync(
        Guid lotId,
        Guid incidentId,
        int page,
        int pageSize,
        CancellationToken ct);

    /// <summary>
    /// Quản lý mở lại sự cố từ trạng thái Resolved về Open kèm lý do ghi vết lịch sử.
    /// </summary>
    Task<IncidentDto> ReopenIncidentAsync(
        Guid lotId,
        Guid incidentId,
        Guid actorId,
        ReopenIncidentRequestDto request,
        CancellationToken ct);

    /// <summary>
    /// Hủy bỏ sự cố (trường hợp báo nhầm) kèm lý do, chuyển trạng thái sang Cancelled thay vì xóa cứng.
    /// </summary>
    Task<IncidentDto> CancelIncidentAsync(
        Guid lotId,
        Guid incidentId,
        Guid actorId,
        CancelIncidentRequestDto request,
        CancellationToken ct);

    /// <summary>
    /// Quản lý ban hành quyết định phê duyệt (Approved) hoặc từ chối (Rejected) ngoại lệ xuất bãi kèm chứng cứ đối chiếu.
    /// </summary>
    Task<IncidentExitDecisionDto> CreateIncidentDecisionAsync(
        Guid lotId,
        Guid incidentId,
        Guid actorId,
        CreateIncidentDecisionRequestDto request,
        CancellationToken ct);

    // ==========================================
    // SCRUM-99: Shift Handovers
    // ==========================================

    /// <summary>
    /// Nhân viên giao ca tạo biên bản bàn giao ca trực mới (PendingConfirmation).
    /// Ràng buộc: Cấm tự giao tự nhận (senderUserId != receiverUserId).
    /// </summary>
    Task<ShiftHandoverDto> CreateShiftHandoverAsync(
        Guid lotId,
        Guid actorId,
        CreateShiftHandoverRequestDto request,
        string? key,
        CancellationToken ct);

    /// <summary>
    /// Liệt kê danh sách biên bản bàn giao ca (Staff chỉ xem ca mình gửi/nhận; Manager xem toàn bộ bãi).
    /// </summary>
    Task<PagedResult<ShiftHandoverSummaryDto>> ListShiftHandoversAsync(
        Guid lotId,
        Guid actorId,
        bool isManager,
        string? status,
        int page,
        int pageSize,
        CancellationToken ct);

    /// <summary>
    /// Xem chi tiết biên bản bàn giao ca trực kèm kiểm tra phân quyền phạm vi truy cập.
    /// </summary>
    Task<ShiftHandoverDto?> GetShiftHandoverByIdAsync(
        Guid lotId,
        Guid handoverId,
        Guid actorId,
        bool isManager,
        CancellationToken ct);

    /// <summary>
    /// Nhân viên nhận ca xác nhận hoàn tất nhận ca trực (Handshake 2 bên: PendingConfirmation -> Confirmed).
    /// </summary>
    Task<ShiftHandoverDto> ConfirmShiftHandoverAsync(
        Guid lotId,
        Guid handoverId,
        Guid actorId,
        ConfirmShiftHandoverRequestDto request,
        string? key,
        CancellationToken ct);

    /// <summary>
    /// Quản lý chỉ định lại nhân viên nhận ca khi người cũ vắng mặt hoặc tài khoản bị khóa (chỉ khi đang chờ nhận).
    /// </summary>
    Task<ShiftHandoverDto> ReassignReceiverAsync(
        Guid lotId,
        Guid handoverId,
        Guid actorId,
        ReassignReceiverRequestDto request,
        CancellationToken ct);
}


