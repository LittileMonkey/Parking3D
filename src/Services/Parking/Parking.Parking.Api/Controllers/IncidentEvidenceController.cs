using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Parking.Parking.Application;
using Parking.Parking.Application.DTOs;
using Parking.Parking.Application.Interfaces;
using Parking.ServiceDefaults;

namespace Parking.Parking.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/parking-lots/{lotId:guid}/evidence")]
public sealed class IncidentEvidenceController(IIncidentEvidenceRepository repository, IFacilityAccess access) : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> Upload(Guid lotId, UploadIncidentEvidenceRequestDto request, CancellationToken ct)
    {
        var key = Request.ReadRequiredIdempotencyKey();
        var actor = User.Subject();
        await access.RequireAsync(actor, lotId, "INCIDENT_WRITE", ct);
        var result = await repository.UploadIncidentEvidenceAsync(lotId, actor, request, key, ct);
        return StatusCode(201, new ApiResponse<IncidentEvidenceImageDto>(result, true, 201, "Evidence image saved."));
    }

    [HttpGet("{evidenceId:guid}")]
    public async Task<IActionResult> Read(Guid lotId, Guid evidenceId, CancellationToken ct)
    {
        await access.RequireAsync(User.Subject(), lotId, "INCIDENT_READ", ct);
        var result = await repository.ReadIncidentEvidenceAsync(lotId, evidenceId, ct);
        if (result is null) return NotFound(new ApiResponse<object>(null, false, 404, "Evidence image not found."));
        return Ok(new ApiResponse<IncidentEvidenceImageContentDto>(result, true, 200, "Evidence image retrieved."));
    }
}
