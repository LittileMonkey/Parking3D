using ParkingSystem.Domain.Common;
using ParkingSystem.Domain.Enums;

namespace ParkingSystem.Domain.Entities;

/// <summary>
/// Lịch sử quét và nhận diện biển số xe qua camera tại cổng
/// </summary>
public class LicensePlateLog : BaseEntity
{
    /// <summary>
    /// Biển số xe sau khi được làm sạch và chuẩn hóa (VD: 51K-888.88)
    /// </summary>
    public string NormalizedPlate { get; set; } = string.Empty;

    /// <summary>
    /// Chuỗi thô nhận diện được từ OCR trước khi định dạng
    /// </summary>
    public string RawPlate { get; set; } = string.Empty;

    /// <summary>
    /// Độ tin cậy nhận diện (0.0 đến 1.0)
    /// </summary>
    public double Confidence { get; set; }

    /// <summary>
    /// Mã định danh cổng quét (VD: GATE_IN_01, GATE_OUT_02)
    /// </summary>
    public string GateId { get; set; } = string.Empty;

    /// <summary>
    /// Chiều lưu thông: IN (Vào) hoặc OUT (Ra)
    /// </summary>
    public string Direction { get; set; } = "IN";

    /// <summary>
    /// Trạng thái nhận diện: Success, LowConfidence, Failed
    /// </summary>
    public RecognitionStatus Status { get; set; } = RecognitionStatus.Success;

    /// <summary>
    /// Loại phương tiện phỏng đoán hoặc liên kết
    /// </summary>
    public VehicleType VehicleType { get; set; } = VehicleType.Car;

    /// <summary>
    /// Loại biển số: OneLine (1 dòng) hoặc TwoLine (2 dòng)
    /// </summary>
    public string PlateType { get; set; } = "OneLine";

    /// <summary>
    /// Ảnh đã crop vùng biển số dạng Base64 (phục vụ đối soát/hiển thị)
    /// </summary>
    public string? CroppedPlateBase64 { get; set; }

    /// <summary>
    /// Mã bãi xe liên kết
    /// </summary>
    public Guid? ParkingLotId { get; set; }
}
