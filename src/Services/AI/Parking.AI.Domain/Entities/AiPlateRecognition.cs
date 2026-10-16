namespace Parking.AI.Domain.Entities;

/// <summary>
/// Thực thể ánh xạ bảng ai_plate_recognitions theo chuẩn thiết kế V4
/// </summary>
public class AiPlateRecognition
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? UpdatedAt { get; set; }

    public Guid LotId { get; set; }
    public Guid UploadedBy { get; set; }
    public string IdempotencyKey { get; set; } = string.Empty;
    public string ImageSha256 { get; set; } = string.Empty;
    public string? ImageObjectKey { get; set; }
    public string? CandidatePlate { get; set; }
    public decimal? Confidence { get; set; }
    public string Status { get; set; } = "PROCESSING"; // PROCESSING, PENDING_REVIEW, NO_PLATE, FAILED, REVIEWED, CONSUMED
    public string ModelVersion { get; set; } = "yolov8-paddleocr-v1";
    public string? ReviewedPlate { get; set; }
    public Guid? ReviewedBy { get; set; }
    public DateTimeOffset? ReviewedAt { get; set; }
    public DateTimeOffset? ConsumedAt { get; set; }
    public string? FailureCode { get; set; }
    public DateTimeOffset ExpiresAt { get; set; } = DateTimeOffset.UtcNow.AddHours(24);
    public int Version { get; set; } = 1;
}
