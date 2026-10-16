using Parking.AI.Application.DTOs.LicensePlate;

namespace Parking.AI.Application.Interfaces;

/// <summary>
/// Giao diện dịch vụ nhận diện biển số xe (Computer Vision / AI Vision)
/// </summary>
public interface ILicensePlateRecognitionService
{
    /// <summary>
    /// Nhận diện biển số xe từ ảnh (Base64 hoặc byte array), chuẩn hóa và lưu log
    /// </summary>
    Task<PlateRecognitionResultDto> RecognizePlateAsync(PlateRecognitionRequestDto request, CancellationToken cancellationToken = default);

    /// <summary>
    /// Nhận diện biển số xe trực tiếp từ mảng byte của file ảnh
    /// </summary>
    Task<PlateRecognitionResultDto> RecognizePlateFromBytesAsync(
        byte[] imageBytes,
        string gateId,
        string direction,
        Guid? parkingLotId = null,
        string? idempotencyKey = null,
        Guid? uploadedBy = null,
        CancellationToken cancellationToken = default);
}
