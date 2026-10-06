namespace ParkingSystem.Domain.Enums;

/// <summary>
/// Trạng thái kết quả nhận diện biển số xe từ AI Vision
/// </summary>
public enum RecognitionStatus
{
    Success = 1,
    LowConfidence = 2,
    Failed = 3,
    Unrecognized = 4
}
