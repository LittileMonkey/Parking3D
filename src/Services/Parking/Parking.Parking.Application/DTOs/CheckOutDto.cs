namespace Parking.Parking.Application.DTOs;

/// <summary>
/// Yêu cầu tra cứu phiên đỗ, đối soát biển số và tính toán cước phí tại cổng ra.
/// </summary>
public sealed record CheckOutQuoteRequestDto(
    Guid LotId,
    Guid GateId,
    string DetectedPlate,
    string? QrPayload = null);

/// <summary>
/// Kết quả tra cứu cước phí và đối soát biển số trước khi thanh toán xuất bãi.
/// </summary>
public sealed record CheckOutQuoteResultDto(
    Guid SessionId,
    Guid? BookingId,
    Guid SlotId,
    string SlotCode,
    string EntryPlate,
    string ExitPlate,
    bool IsPlateMatched,
    DateTimeOffset EntryAt,
    DateTimeOffset ExpectedExitAt,
    DateTimeOffset QuoteAt,
    int TotalDurationMinutes,
    int OverdueMinutes,
    decimal PrepaidAmount,
    decimal OvertimeAmount,
    decimal TotalAmountDue,
    bool PaymentRequired,
    string? IncidentCode = null);

/// <summary>
/// Yêu cầu xác nhận hoàn tất check-out sau khi thanh toán và mở barrier cho xe xuất bãi.
/// </summary>
public sealed record ConfirmCheckOutRequestDto(
    Guid SessionId,
    Guid GateId,
    string PaymentMethod,
    decimal CashReceived = 0,
    string? PaymentReference = null,
    string? StaffNotes = null);

/// <summary>
/// Kết quả phản hồi sau khi check-out thành công và giải phóng ô đỗ.
/// </summary>
public sealed record ConfirmCheckOutResultDto(
    Guid SessionId,
    Guid? BookingId,
    Guid LotId,
    Guid SlotId,
    string SlotCode,
    DateTimeOffset ExitedAt,
    decimal FinalAmountPaid,
    string PaymentMethod,
    string BarrierStatus,
    string SlotStatus);
