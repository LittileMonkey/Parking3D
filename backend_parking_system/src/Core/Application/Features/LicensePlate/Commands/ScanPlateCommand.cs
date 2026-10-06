using ParkingSystem.Application.Features.LicensePlate.DTOs;

namespace ParkingSystem.Application.Features.LicensePlate.Commands;

/// <summary>
/// Command thực thi nghiệp vụ quét và nhận diện biển số xe
/// </summary>
public record ScanPlateCommand(
    string? ImageBase64,
    byte[]? ImageBytes,
    string GateId,
    string Direction,
    Guid? ParkingLotId)
{
    public static ScanPlateCommand FromDto(PlateRecognitionRequestDto dto, byte[]? bytes = null) =>
        new(dto.ImageBase64, bytes, dto.GateId, dto.Direction, dto.ParkingLotId);
}
