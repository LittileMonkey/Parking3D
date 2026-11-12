namespace Parking.Parking.Application.DTOs;

public sealed record UploadIncidentEvidenceRequestDto(string ContentType, string ImageBase64);

public sealed record IncidentEvidenceImageDto(
    Guid EvidenceId,
    Guid LotId,
    string ContentType,
    string Reference,
    string Sha256,
    int SizeBytes,
    DateTimeOffset CreatedAt);

public sealed record IncidentEvidenceImageContentDto(IncidentEvidenceImageDto Metadata, string ImageBase64);
