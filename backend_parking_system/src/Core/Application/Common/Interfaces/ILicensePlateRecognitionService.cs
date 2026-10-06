using ParkingSystem.Application.Features.LicensePlate.DTOs;

namespace ParkingSystem.Application.Common.Interfaces;

/// <summary>
/// Giao diện dịch vụ nhận diện biển số xe (Computer Vision / AI Vision)
/// </summary>
public interface ILicensePlateRecognitionService
{
    /// <summary>
    /// Nhận diện biển số xe từ ảnh (Base64 hoặc byte array), chuẩn hóa và lưu log
    /// </summary>
    /// <param name="request">Thông tin ảnh và cổng quét</param>
    /// <param name="cancellationToken">Hủy thao tác</param>
    /// <returns>Kết quả biển số xe, độ tin cậy và ảnh crop</returns>
    Task<PlateRecognitionResultDto> RecognizePlateAsync(PlateRecognitionRequestDto request, CancellationToken cancellationToken = default);

    /// <summary>
    /// Nhận diện biển số xe trực tiếp từ mảng byte của file ảnh
    /// </summary>
    Task<PlateRecognitionResultDto> RecognizePlateFromBytesAsync(byte[] imageBytes, string gateId, string direction, Guid? parkingLotId = null, CancellationToken cancellationToken = default);
}
