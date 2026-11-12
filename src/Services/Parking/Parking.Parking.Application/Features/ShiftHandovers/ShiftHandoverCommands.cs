using FluentValidation;
using MediatR;
using Parking.Parking.Application.DTOs;
using Parking.Parking.Application.Interfaces;

namespace Parking.Parking.Application.Features.ShiftHandovers;

/// <summary>
/// Command khởi tạo biên bản bàn giao ca trực mới.
/// </summary>
public sealed record CreateShiftHandoverCommand(
    Guid LotId,
    Guid ActorId,
    CreateShiftHandoverRequestDto Request,
    string? IdempotencyKey
) : IRequest<ShiftHandoverDto>;

/// <summary>
/// Validator kiểm tra tính hợp lệ của biên bản bàn giao ca (chặn tự giao tự nhận).
/// </summary>
public sealed class CreateShiftHandoverCommandValidator : AbstractValidator<CreateShiftHandoverCommand>
{
    public CreateShiftHandoverCommandValidator()
    {
        RuleFor(x => x.LotId).NotEmpty();
        RuleFor(x => x.ActorId).NotEmpty();
        RuleFor(x => x.Request).NotNull();
        When(x => x.Request is not null, () =>
        {
            RuleFor(x => x.Request.SenderShiftId).NotEmpty();
            RuleFor(x => x.Request.ReceiverShiftId).NotEmpty();
            RuleFor(x => x.Request.ReceiverUserId).NotEmpty();
            RuleFor(x => x.Request.ReceiverUserId)
                .NotEqual(x => x.ActorId)
                .WithMessage("Người bàn giao và người nhận ca không được là cùng một người (không tự giao tự nhận).");
            RuleFor(x => x.Request.CompletedTasks).NotEmpty().MaximumLength(2000);
            RuleFor(x => x.Request.UnresolvedIssues).NotEmpty().MaximumLength(2000);
            RuleFor(x => x.Request.PendingTransactions).NotEmpty().MaximumLength(2000);
            RuleFor(x => x.Request.NotesForNext).NotEmpty().MaximumLength(2000);
            When(x => !string.IsNullOrWhiteSpace(x.Request.EquipmentStatus), () =>
            {
                RuleFor(x => x.Request.EquipmentStatus!).MaximumLength(2000);
            });
        });
        When(x => !string.IsNullOrWhiteSpace(x.IdempotencyKey), () =>
        {
            RuleFor(x => x.IdempotencyKey!).MaximumLength(128);
        });
    }
}

/// <summary>
/// Command nhân viên nhận ca xác nhận hoàn tất nhận ca (Handshake).
/// </summary>
public sealed record ConfirmShiftHandoverCommand(
    Guid LotId,
    Guid HandoverId,
    Guid ActorId,
    ConfirmShiftHandoverRequestDto Request,
    string? IdempotencyKey
) : IRequest<ShiftHandoverDto>;

/// <summary>
/// Validator kiểm tra ràng buộc phiên bản cho xác nhận nhận ca.
/// </summary>
public sealed class ConfirmShiftHandoverCommandValidator : AbstractValidator<ConfirmShiftHandoverCommand>
{
    public ConfirmShiftHandoverCommandValidator()
    {
        RuleFor(x => x.LotId).NotEmpty();
        RuleFor(x => x.HandoverId).NotEmpty();
        RuleFor(x => x.ActorId).NotEmpty();
        RuleFor(x => x.Request).NotNull();
        When(x => x.Request is not null, () =>
        {
            RuleFor(x => x.Request.ExpectedVersion).GreaterThan(0);
        });
        When(x => !string.IsNullOrWhiteSpace(x.IdempotencyKey), () =>
        {
            RuleFor(x => x.IdempotencyKey!).MaximumLength(128);
        });
    }
}

/// <summary>
/// Command Quản lý chỉ định lại nhân viên nhận ca khi người cũ vắng mặt.
/// </summary>
public sealed record ReassignReceiverCommand(
    Guid LotId,
    Guid HandoverId,
    Guid ActorId,
    ReassignReceiverRequestDto Request
) : IRequest<ShiftHandoverDto>;

/// <summary>
/// Validator kiểm tra ràng buộc cho việc đổi người nhận ca.
/// </summary>
public sealed class ReassignReceiverCommandValidator : AbstractValidator<ReassignReceiverCommand>
{
    public ReassignReceiverCommandValidator()
    {
        RuleFor(x => x.LotId).NotEmpty();
        RuleFor(x => x.HandoverId).NotEmpty();
        RuleFor(x => x.ActorId).NotEmpty();
        RuleFor(x => x.Request).NotNull();
        When(x => x.Request is not null, () =>
        {
            RuleFor(x => x.Request.ReceiverUserId).NotEmpty();
            RuleFor(x => x.Request.Reason).NotEmpty().MaximumLength(2000);
            RuleFor(x => x.Request.ExpectedVersion).GreaterThan(0);
        });
    }
}

/// <summary>
/// Handler xử lý các Command bàn giao ca trực và kiểm tra quyền cơ sở.
/// </summary>
public sealed class ShiftHandoverCommandHandlers(
    IParkingRepository repository,
    IFacilityAccess access
) :
    IRequestHandler<CreateShiftHandoverCommand, ShiftHandoverDto>,
    IRequestHandler<ConfirmShiftHandoverCommand, ShiftHandoverDto>,
    IRequestHandler<ReassignReceiverCommand, ShiftHandoverDto>
{
    /// <summary>Xử lý tạo biên bản bàn giao sau khi xác thực quyền HANDOVER.</summary>
    public async Task<ShiftHandoverDto> Handle(CreateShiftHandoverCommand command, CancellationToken ct)
    {
        await access.RequireAsync(command.ActorId, command.LotId, "HANDOVER", ct);
        await access.RequireAsync(command.Request.ReceiverUserId, command.LotId, "HANDOVER", ct);
        return await repository.CreateShiftHandoverAsync(command.LotId, command.ActorId, command.Request, command.IdempotencyKey, ct);
    }

    /// <summary>Xử lý xác nhận nhận ca sau khi xác thực quyền HANDOVER.</summary>
    public async Task<ShiftHandoverDto> Handle(ConfirmShiftHandoverCommand command, CancellationToken ct)
    {
        await access.RequireAsync(command.ActorId, command.LotId, "HANDOVER", ct);
        return await repository.ConfirmShiftHandoverAsync(command.LotId, command.HandoverId, command.ActorId, command.Request, command.IdempotencyKey, ct);
    }

    /// <summary>Xử lý đổi người nhận ca sau khi xác thực quyền MANAGER.</summary>
    public async Task<ShiftHandoverDto> Handle(ReassignReceiverCommand command, CancellationToken ct)
    {
        await access.RequireAsync(command.ActorId, command.LotId, "MANAGER", ct);
        await access.RequireAsync(command.Request.ReceiverUserId, command.LotId, "HANDOVER", ct);
        return await repository.ReassignReceiverAsync(command.LotId, command.HandoverId, command.ActorId, command.Request, ct);
    }
}
