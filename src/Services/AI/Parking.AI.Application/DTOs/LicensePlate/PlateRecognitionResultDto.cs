using Parking.AI.Domain.Enums;

namespace Parking.AI.Application.DTOs.LicensePlate;

/// <summary>
/// DTO kết quả nhận diện biển số xe sau khi được làm sạch và chuẩn hóa
/// </summary>
public record PlateRecognitionResultDto
{
    /// <summary>
    /// ID bản ghi nhận diện đã được lưu vào CSDL ai_plate_recognitions (nếu có)
    /// </summary>
    public Guid? RecognitionId { get; init; }

    /// <summary>
    /// Biển số xe đã được làm sạch và định dạng chuẩn Việt Nam hiển thị giao diện (VD: 51K-888.88 hoặc 59-P1 678.90)
    /// </summary>
    public string DisplayPlate { get; init; } = string.Empty;

    /// <summary>
    /// Biển số xe chuẩn hóa dạng chữ và số liền mạch lưu trữ CSDL (VD: 51K88888) tuân thủ regex ^[A-Z0-9]{1,20}$
    /// </summary>
    public string PlateNumber { get; init; } = string.Empty;

    /// <summary>
    /// Biển số xe chuẩn hóa (tương thích ngược với PlateNumber)
    /// </summary>
    public string NormalizedPlate { get; init; } = string.Empty;

    /// <summary>
    /// Chuỗi thô ban đầu nhận diện từ mô hình OCR
    /// </summary>
    public string RawPlate { get; init; } = string.Empty;

    /// <summary>
    /// Tỷ lệ độ tin cậy nhận diện (0.0 đến 1.0, ví dụ 0.98 là 98%)
    /// </summary>
    public double Confidence { get; init; }

    /// <summary>
    /// Loại biển số: OneLine (1 dòng) hoặc TwoLine (2 dòng)
    /// </summary>
    public string PlateType { get; init; } = "OneLine";

    /// <summary>
    /// Ảnh đã cắt (crop) riêng vùng biển số mã hóa Base64
    /// </summary>
    public string? CroppedPlateBase64 { get; init; }

    /// <summary>
    /// Trạng thái nhận diện: Success, LowConfidence, Failed
    /// </summary>
    public RecognitionStatus Status { get; init; } = RecognitionStatus.Success;

    /// <summary>
    /// Dự đoán loại phương tiện dựa trên cấu trúc sê-ri biển số
    /// </summary>
    public VehicleType VehicleTypeSuggestion { get; init; } = VehicleType.Car;

    /// <summary>
    /// Thời gian xử lý nhận diện (milliseconds)
    /// </summary>
    public long ProcessingTimeMs { get; init; }

    /// <summary>
    /// Cờ đánh dấu kết quả được sinh từ bộ giả lập fallback an toàn khi server Python ngoại tuyến
    /// </summary>
    public bool IsFallback { get; init; }
}
