namespace Parking.AI.Application.DTOs.LicensePlate;

/// <summary>
/// DTO yêu cầu nhận diện biển số xe từ camera cổng vào/ra
/// </summary>
public record PlateRecognitionRequestDto
{
    /// <summary>
    /// Chuỗi dữ liệu ảnh mã hóa Base64 (nếu gửi dạng JSON)
    /// </summary>
    public string? ImageBase64 { get; init; }

    /// <summary>
    /// Mã định danh cổng quét (VD: GATE_IN_01, GATE_OUT_01)
    /// </summary>
    public string GateId { get; init; } = "GATE_IN_01";

    /// <summary>
    /// Hướng di chuyển của xe: "IN" (Vào) hoặc "OUT" (Ra)
    /// </summary>
    public string Direction { get; init; } = "IN";

    /// <summary>
    /// Mã bãi đỗ xe (ParkingLotId) nếu có
    /// </summary>
    public Guid? ParkingLotId { get; init; }

    /// <summary>
    /// Khóa chống trùng lặp (Idempotency Key)
    /// </summary>
    public string? IdempotencyKey { get; init; }

    /// <summary>
    /// Mã người dùng hoặc nhân viên tải ảnh lên
    /// </summary>
    public Guid? UploadedBy { get; init; }
}
