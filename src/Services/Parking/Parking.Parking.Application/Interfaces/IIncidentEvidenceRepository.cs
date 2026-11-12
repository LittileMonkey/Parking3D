using Parking.Parking.Application.DTOs;

namespace Parking.Parking.Application.Interfaces;

public interface IIncidentEvidenceRepository
{
    Task<IncidentEvidenceImageDto> UploadIncidentEvidenceAsync(Guid lotId, Guid actorId,
        UploadIncidentEvidenceRequestDto request, string key, CancellationToken ct);

    Task<IncidentEvidenceImageContentDto?> ReadIncidentEvidenceAsync(Guid lotId, Guid evidenceId, CancellationToken ct);
}
