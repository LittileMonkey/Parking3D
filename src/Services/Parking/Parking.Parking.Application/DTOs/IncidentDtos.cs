namespace Parking.Parking.Application.DTOs;

public sealed record IncidentEvidenceDto(
    string Kind,
    string Reference,
    DateTimeOffset? CapturedAt
);

public sealed record IncidentExitDecisionDto(
    Guid DecisionId,
    Guid IncidentId,
    string Decision,
    string Reason,
    Guid DecidedByUserId,
    DateTimeOffset DecidedAt,
    IReadOnlyList<IncidentEvidenceDto> Evidence,
    int NewVersion
);

public sealed record CreateIncidentRequestDto(
    string Title,
    string Type,
    string Severity,
    string Description,
    DateTimeOffset DetectedAt,
    string? LateReportReason = null,
    string? RelatedPlate = null,
    string? RelatedSlotCode = null,
    string? RelatedGate = null,
    Guid? RelatedBookingId = null,
    Guid? RelatedSessionId = null,
    IReadOnlyList<IncidentEvidenceDto>? Evidence = null
);

public sealed record IncidentDto(
    Guid IncidentId,
    Guid LotId,
    string Title,
    string Type,
    string Severity,
    string Description,
    string Status,
    Guid? ReportedByUserId,
    DateTimeOffset DetectedAt,
    DateTimeOffset ReportedAt,
    DateTimeOffset UpdatedAt,
    DateTimeOffset? ResolvedAt,
    string? LateReportReason,
    string? RelatedPlate,
    string? RelatedSlotCode,
    string? RelatedGate,
    Guid? RelatedBookingId,
    Guid? RelatedSessionId,
    IReadOnlyList<IncidentEvidenceDto> Evidence,
    IncidentExitDecisionDto? ExitDecision,
    int Version
);

public sealed record IncidentSummaryDto(
    Guid IncidentId,
    Guid LotId,
    string Title,
    string Type,
    string Severity,
    string Status,
    string? RelatedPlate,
    string? RelatedSlotCode,
    DateTimeOffset ReportedAt,
    DateTimeOffset UpdatedAt,
    int Version
);

public sealed record IncidentHistoryItemDto(
    Guid Id,
    Guid IncidentId,
    string Action,
    string? FromStatus,
    string? ToStatus,
    Guid PerformedByUserId,
    DateTimeOffset PerformedAt,
    string? Reason
);

public sealed record UpdateIncidentStatusRequestDto(
    string Status,
    string? Notes,
    int ExpectedVersion
);

public sealed record ReopenIncidentRequestDto(
    string Reason,
    int ExpectedVersion
);

public sealed record CancelIncidentRequestDto(
    string Reason,
    int ExpectedVersion
);

public sealed record CreateIncidentDecisionRequestDto(
    string Decision,
    string Reason,
    IReadOnlyList<IncidentEvidenceDto> Evidence,
    int ExpectedVersion
);
