namespace Parking.Parking.Application.DTOs;

/// <summary>
/// Yêu cầu tra cứu phiên đỗ, đối soát biển số và tính toán cước phí tại cổng ra.
/// </summary>
public sealed record CheckOutQuoteRequestDto(
    Guid LotId,
    Guid GateId,
    string DetectedPlate,
    string? QrPayload = null,
    Guid? SessionId = null);

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
    string? IncidentCode = null,
    string? QuoteToken = null,
    DateTimeOffset? ValidUntil = null,
    Guid PricingSnapshotId = default,
    Guid VehicleId = default,
    decimal CheckoutCredit = 0);

/// <summary>
/// Yêu cầu xác nhận hoàn tất check-out sau khi thanh toán và mở barrier cho xe xuất bãi.
/// </summary>
public sealed record ConfirmCheckOutRequestDto(
    Guid SessionId,
    Guid GateId,
    string PaymentMethod,
    decimal CashReceived = 0,
    string? PaymentReference = null,
    string? StaffNotes = null,
    string DetectedPlate = "",
    string QuoteToken = "",
    bool StaffObservedExit = false,
    string ExitPermitToken = "");

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
    string SlotStatus,
    Guid? PaymentId = null);

// Internal claims: signed by Parking, never accepted as a plain object from an API client.
public sealed record CheckOutProof(Guid QuoteId, Guid ActorId, Guid SessionId, Guid LotId,
    Guid GateId, Guid SlotId, Guid VehicleId, Guid PricingSnapshotId, string Plate,
    DateTimeOffset QuoteAt, DateTimeOffset ExpiresAt, decimal GrossAmount);
public sealed record CheckOutPaymentEvidence(Guid? PaymentId, Guid SessionId, Guid LotId,
    decimal AmountPaid, string Currency, string Method);
public sealed record CheckOutVerification(CheckOutProof Proof, CheckOutPaymentEvidence Payment);
public sealed record CheckOutQrDto(string QrPayload, DateTimeOffset ExpiresAt);
public sealed record AuthorizeCheckOutResultDto(Guid SessionId, string ExitPermitToken,
    DateTimeOffset ValidUntil, decimal AmountPaid, Guid? PaymentId,
    string BarrierStatus = "MANUAL_OPEN_AUTHORIZED", string SlotStatus = "OCCUPIED");
