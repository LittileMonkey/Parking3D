using FluentValidation;
using MediatR;
using Parking.Parking.Application.DTOs;
using Parking.Parking.Application.Interfaces;

namespace Parking.Parking.Application.Features.Incidents;

/// <summary>
/// Shared validation helpers for incident evidence references and Q07 decision requirements.
/// </summary>
public static class IncidentEvidenceRules
{
    private static readonly HashSet<string> CameraKinds = new(StringComparer.OrdinalIgnoreCase)
    {
        "CAMERA", "CAMERA_SNAPSHOT", "GATE_CAMERA"
    };

    private static readonly HashSet<string> VehicleDocKinds = new(StringComparer.OrdinalIgnoreCase)
    {
        "VEHICLE_REGISTRATION", "VEHICLE_DOCUMENT", "DOCUMENTS"
    };

    public static bool IsSafeReference(string? reference)
    {
        if (string.IsNullOrWhiteSpace(reference))
            return false;
        var trimmed = reference.Trim();
        if (trimmed.Length > 2048)
            return false;
        var lower = trimmed.ToLowerInvariant();
        if (lower.StartsWith("data:", StringComparison.Ordinal) ||
            lower.StartsWith("javascript:", StringComparison.Ordinal) ||
            lower.StartsWith("file:", StringComparison.Ordinal) ||
            lower.Contains(";base64,", StringComparison.Ordinal))
        {
            return false;
        }
        return true;
    }

    public static bool AreAllItemsValid(IReadOnlyList<IncidentEvidenceDto>? evidence)
    {
        if (evidence is null || evidence.Count == 0)
            return true;
        foreach (var item in evidence)
        {
            if (item is null ||
                string.IsNullOrWhiteSpace(item.Kind) ||
                item.Kind.Trim().Length > 64 ||
                !IsSafeReference(item.Reference))
            {
                return false;
            }
        }
        return true;
    }

    public static bool HasApprovedExitEvidence(IReadOnlyList<IncidentEvidenceDto>? evidence, bool requireCameraTimestamp = false)
    {
        if (evidence is null || evidence.Count == 0 || !AreAllItemsValid(evidence))
            return false;

        var hasCamera = evidence.Any(e =>
            CameraKinds.Contains(e.Kind.Trim()) &&
            (!requireCameraTimestamp || e.CapturedAt.HasValue));
        var hasVehicleDoc = evidence.Any(e => VehicleDocKinds.Contains(e.Kind.Trim()));
        return hasCamera && hasVehicleDoc;
    }
}

/// <summary>
/// Command báo cáo sự cố hoặc ngoại lệ mới tại bãi đỗ xe.
/// </summary>
public sealed record CreateIncidentCommand(
    Guid LotId,
    Guid ActorId,
    CreateIncidentRequestDto Request,
    string? IdempotencyKey
) : IRequest<IncidentDto>;

/// <summary>
/// Validator kiểm tra ràng buộc đầu vào cho lệnh tạo sự cố mới.
/// </summary>
public sealed class CreateIncidentCommandValidator : AbstractValidator<CreateIncidentCommand>
{
    public CreateIncidentCommandValidator()
    {
        RuleFor(x => x.LotId).NotEmpty();
        RuleFor(x => x.ActorId).NotEmpty();
        RuleFor(x => x.Request).NotNull();
        When(x => x.Request is not null, () =>
        {
            RuleFor(x => x.Request.Title).NotEmpty().MaximumLength(200);
            RuleFor(x => x.Request.Type).NotEmpty().MaximumLength(64);
            RuleFor(x => x.Request.Severity).NotEmpty()
                .Must(s => s is "Low" or "Medium" or "High" or "Critical")
                .WithMessage("Severity must be Low, Medium, High, or Critical.");
            RuleFor(x => x.Request.Description).NotEmpty().MaximumLength(4000);
            RuleFor(x => x.Request.DetectedAt).NotEmpty();
            When(x => !string.IsNullOrWhiteSpace(x.Request.LateReportReason), () =>
            {
                RuleFor(x => x.Request.LateReportReason!).MaximumLength(2000);
            });
            RuleFor(x => x.Request.Evidence)
                .Must(IncidentEvidenceRules.AreAllItemsValid)
                .WithMessage("Each evidence item must specify a valid kind and a safe non-base64 reference (max 2048 chars).");
        });
        When(x => !string.IsNullOrWhiteSpace(x.IdempotencyKey), () =>
        {
            RuleFor(x => x.IdempotencyKey!).MaximumLength(128);
        });
    }
}

/// <summary>
/// Command cập nhật tiến độ xử lý sự cố (Staff/Manager).
/// </summary>
public sealed record UpdateIncidentStatusCommand(
    Guid LotId,
    Guid IncidentId,
    Guid ActorId,
    UpdateIncidentStatusRequestDto Request,
    string? IdempotencyKey = null
) : IRequest<IncidentDto>;

/// <summary>
/// Validator kiểm tra ràng buộc đầu vào cho lệnh cập nhật trạng thái sự cố.
/// </summary>
public sealed class UpdateIncidentStatusCommandValidator : AbstractValidator<UpdateIncidentStatusCommand>
{
    public UpdateIncidentStatusCommandValidator()
    {
        RuleFor(x => x.LotId).NotEmpty();
        RuleFor(x => x.IncidentId).NotEmpty();
        RuleFor(x => x.ActorId).NotEmpty();
        RuleFor(x => x.Request).NotNull();
        When(x => x.Request is not null, () =>
        {
            RuleFor(x => x.Request.Status).NotEmpty()
                .Must(s => s is "InProgress" or "Escalated" or "Resolved")
                .WithMessage("Status must be InProgress, Escalated, or Resolved.");
            RuleFor(x => x.Request.ExpectedVersion).GreaterThan(0);
            When(x => x.Request.Status is "Escalated" or "Resolved", () =>
            {
                RuleFor(x => x.Request.Notes)
                    .NotEmpty()
                    .WithMessage("Notes are required when escalating or resolving an incident.");
            });
            When(x => !string.IsNullOrWhiteSpace(x.Request.Notes), () =>
            {
                RuleFor(x => x.Request.Notes!).MaximumLength(2000);
            });
        });
        When(x => !string.IsNullOrWhiteSpace(x.IdempotencyKey), () =>
        {
            RuleFor(x => x.IdempotencyKey!).MaximumLength(128);
        });
    }
}

/// <summary>
/// Command Quản lý mở lại sự cố từ trạng thái Resolved về Open.
/// </summary>
public sealed record ReopenIncidentCommand(
    Guid LotId,
    Guid IncidentId,
    Guid ActorId,
    ReopenIncidentRequestDto Request,
    string? IdempotencyKey = null
) : IRequest<IncidentDto>;

/// <summary>
/// Validator kiểm tra ràng buộc cho lệnh mở lại sự cố.
/// </summary>
public sealed class ReopenIncidentCommandValidator : AbstractValidator<ReopenIncidentCommand>
{
    public ReopenIncidentCommandValidator()
    {
        RuleFor(x => x.LotId).NotEmpty();
        RuleFor(x => x.IncidentId).NotEmpty();
        RuleFor(x => x.ActorId).NotEmpty();
        RuleFor(x => x.Request).NotNull();
        When(x => x.Request is not null, () =>
        {
            RuleFor(x => x.Request.Reason).NotEmpty().MaximumLength(2000);
            RuleFor(x => x.Request.ExpectedVersion).GreaterThan(0);
        });
        When(x => !string.IsNullOrWhiteSpace(x.IdempotencyKey), () =>
        {
            RuleFor(x => x.IdempotencyKey!).MaximumLength(128);
        });
    }
}

/// <summary>
/// Command hủy báo cáo sự cố (báo nhầm) kèm lý do.
/// </summary>
public sealed record CancelIncidentCommand(
    Guid LotId,
    Guid IncidentId,
    Guid ActorId,
    CancelIncidentRequestDto Request,
    string? IdempotencyKey = null
) : IRequest<IncidentDto>;

/// <summary>
/// Validator kiểm tra ràng buộc cho lệnh hủy sự cố.
/// </summary>
public sealed class CancelIncidentCommandValidator : AbstractValidator<CancelIncidentCommand>
{
    public CancelIncidentCommandValidator()
    {
        RuleFor(x => x.LotId).NotEmpty();
        RuleFor(x => x.IncidentId).NotEmpty();
        RuleFor(x => x.ActorId).NotEmpty();
        RuleFor(x => x.Request).NotNull();
        When(x => x.Request is not null, () =>
        {
            RuleFor(x => x.Request.Reason).NotEmpty().MaximumLength(2000);
            RuleFor(x => x.Request.ExpectedVersion).GreaterThan(0);
        });
        When(x => !string.IsNullOrWhiteSpace(x.IdempotencyKey), () =>
        {
            RuleFor(x => x.IdempotencyKey!).MaximumLength(128);
        });
    }
}

/// <summary>
/// Command Quản lý ban hành quyết định ngoại lệ xuất bãi kèm chứng cứ.
/// </summary>
public sealed record CreateIncidentDecisionCommand(
    Guid LotId,
    Guid IncidentId,
    Guid ActorId,
    CreateIncidentDecisionRequestDto Request,
    string? IdempotencyKey = null
) : IRequest<IncidentExitDecisionDto>;

/// <summary>
/// Validator kiểm tra ràng buộc cho quyết định xử lý ngoại lệ xuất bãi.
/// </summary>
public sealed class CreateIncidentDecisionCommandValidator : AbstractValidator<CreateIncidentDecisionCommand>
{
    public CreateIncidentDecisionCommandValidator()
    {
        RuleFor(x => x.LotId).NotEmpty();
        RuleFor(x => x.IncidentId).NotEmpty();
        RuleFor(x => x.ActorId).NotEmpty();
        RuleFor(x => x.Request).NotNull();
        When(x => x.Request is not null, () =>
        {
            RuleFor(x => x.Request.Decision).NotEmpty()
                .Must(d => d is "Approved" or "Rejected")
                .WithMessage("Decision must be Approved or Rejected.");
            RuleFor(x => x.Request.Reason).NotEmpty().MaximumLength(2000);
            RuleFor(x => x.Request.ExpectedVersion).GreaterThan(0);
            RuleFor(x => x.Request.Evidence)
                .Must(IncidentEvidenceRules.AreAllItemsValid)
                .WithMessage("Each evidence item must specify a valid kind and a safe non-base64 reference (max 2048 chars).");
            When(x => string.Equals(x.Request.Decision, "Approved", StringComparison.OrdinalIgnoreCase), () =>
            {
                RuleFor(x => x.Request.Evidence)
                    .NotEmpty()
                    .Must(evidence => IncidentEvidenceRules.HasApprovedExitEvidence(evidence))
                    .WithMessage("Quyết định phê duyệt (Approved) bắt buộc phải có đầy đủ chứng cứ camera (CAMERA/CAMERA_SNAPSHOT/GATE_CAMERA) và giấy tờ xe (VEHICLE_REGISTRATION/VEHICLE_DOCUMENT/DOCUMENTS).");
            });
        });
        When(x => !string.IsNullOrWhiteSpace(x.IdempotencyKey), () =>
        {
            RuleFor(x => x.IdempotencyKey!).MaximumLength(128);
        });
    }
}

/// <summary>
/// Handler xử lý điều phối các Command quản lý sự cố và kiểm tra phân quyền cơ sở.
/// </summary>
public sealed class IncidentCommandHandlers(
    IParkingRepository repository,
    IFacilityAccess access
) :
    IRequestHandler<CreateIncidentCommand, IncidentDto>,
    IRequestHandler<UpdateIncidentStatusCommand, IncidentDto>,
    IRequestHandler<ReopenIncidentCommand, IncidentDto>,
    IRequestHandler<CancelIncidentCommand, IncidentDto>,
    IRequestHandler<CreateIncidentDecisionCommand, IncidentExitDecisionDto>
{
    /// <summary>Xử lý tạo sự cố mới sau khi xác thực quyền INCIDENT_WRITE.</summary>
    public async Task<IncidentDto> Handle(CreateIncidentCommand command, CancellationToken ct)
    {
        await access.RequireAsync(command.ActorId, command.LotId, "INCIDENT_WRITE", ct);
        return await repository.CreateIncidentAsync(command.LotId, command.ActorId, command.Request, command.IdempotencyKey, ct);
    }

    /// <summary>Xử lý cập nhật trạng thái sự cố sau khi xác thực quyền INCIDENT_WRITE (và MANAGER khi Resolved).</summary>
    public async Task<IncidentDto> Handle(UpdateIncidentStatusCommand command, CancellationToken ct)
    {
        await access.RequireAsync(command.ActorId, command.LotId, "INCIDENT_WRITE", ct);
        if (string.Equals(command.Request.Status, "Resolved", StringComparison.OrdinalIgnoreCase))
            await access.RequireAsync(command.ActorId, command.LotId, "MANAGER", ct);
        return await repository.UpdateIncidentStatusAsync(command.LotId, command.IncidentId, command.ActorId, command.Request, command.IdempotencyKey, ct);
    }

    /// <summary>Xử lý mở lại sự cố sau khi xác thực quyền MANAGER.</summary>
    public async Task<IncidentDto> Handle(ReopenIncidentCommand command, CancellationToken ct)
    {
        await access.RequireAsync(command.ActorId, command.LotId, "MANAGER", ct);
        return await repository.ReopenIncidentAsync(command.LotId, command.IncidentId, command.ActorId, command.Request, command.IdempotencyKey, ct);
    }

    /// <summary>Xử lý hủy sự cố báo nhầm sau khi xác thực quyền MANAGER.</summary>
    public async Task<IncidentDto> Handle(CancelIncidentCommand command, CancellationToken ct)
    {
        await access.RequireAsync(command.ActorId, command.LotId, "MANAGER", ct);
        return await repository.CancelIncidentAsync(command.LotId, command.IncidentId, command.ActorId, command.Request, command.IdempotencyKey, ct);
    }

    /// <summary>Xử lý ban hành quyết định ngoại lệ sau khi xác thực quyền MANAGER.</summary>
    public async Task<IncidentExitDecisionDto> Handle(CreateIncidentDecisionCommand command, CancellationToken ct)
    {
        await access.RequireAsync(command.ActorId, command.LotId, "MANAGER", ct);
        return await repository.CreateIncidentDecisionAsync(command.LotId, command.IncidentId, command.ActorId, command.Request, command.IdempotencyKey, ct);
    }
}
