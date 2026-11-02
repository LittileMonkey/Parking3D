namespace Parking.Parking.Application.DTOs;

public sealed record CreateShiftHandoverRequestDto(
    Guid SenderShiftId,
    Guid ReceiverShiftId,
    Guid ReceiverUserId,
    string CompletedTasks,
    string UnresolvedIssues,
    string PendingTransactions,
    string? EquipmentStatus,
    string NotesForNext
);

public sealed record ShiftHandoverDto(
    Guid HandoverId,
    Guid LotId,
    Guid SenderShiftId,
    Guid ReceiverShiftId,
    Guid SenderUserId,
    Guid ReceiverUserId,
    string CompletedTasks,
    string UnresolvedIssues,
    string PendingTransactions,
    string? EquipmentStatus,
    string NotesForNext,
    string Status,
    DateTimeOffset CreatedAt,
    DateTimeOffset? ConfirmedAt,
    Guid? ConfirmedByUserId,
    int Version
);

public sealed record ShiftHandoverSummaryDto(
    Guid HandoverId,
    Guid LotId,
    Guid SenderShiftId,
    Guid ReceiverShiftId,
    Guid SenderUserId,
    Guid ReceiverUserId,
    string Status,
    DateTimeOffset CreatedAt,
    DateTimeOffset? ConfirmedAt,
    int Version
);

public sealed record ConfirmShiftHandoverRequestDto(
    int ExpectedVersion
);

public sealed record ReassignReceiverRequestDto(
    Guid ReceiverUserId,
    string Reason,
    int ExpectedVersion
);
