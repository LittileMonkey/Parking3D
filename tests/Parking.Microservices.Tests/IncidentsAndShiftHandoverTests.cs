using FluentValidation.TestHelper;
using Parking.Parking.Application;
using Parking.Parking.Application.DTOs;
using Parking.Parking.Application.Exceptions;
using Parking.Parking.Application.Features.Incidents;
using Parking.Parking.Application.Features.ShiftHandovers;
using Parking.Parking.Application.Interfaces;
using Parking.ServiceDefaults;
using Xunit;

namespace Parking.Microservices.Tests;

/// <summary>
/// Unit Tests cho SCRUM-99: Quản lý Sự cố (Incidents) và Bàn giao ca trực (Shift Handovers).
/// Kiểm thử: Validation rules, Quyền Facility-Scoped RBAC, Cấm tự giao tự nhận, Ràng buộc duyệt kèm chứng cứ.
/// </summary>
public class IncidentsAndShiftHandoverTests
{
    private readonly CreateIncidentCommandValidator _createIncidentValidator = new();
    private readonly UpdateIncidentStatusCommandValidator _updateIncidentStatusValidator = new();
    private readonly ReopenIncidentCommandValidator _reopenIncidentValidator = new();
    private readonly CancelIncidentCommandValidator _cancelIncidentValidator = new();
    private readonly CreateIncidentDecisionCommandValidator _decisionValidator = new();

    private readonly CreateShiftHandoverCommandValidator _createHandoverValidator = new();
    private readonly ConfirmShiftHandoverCommandValidator _confirmHandoverValidator = new();
    private readonly ReassignReceiverCommandValidator _reassignReceiverValidator = new();

    // ==========================================
    // 1. INCIDENTS VALIDATION TESTS
    // ==========================================

    [Fact]
    public void CreateIncidentValidator_ShouldPass_ForValidIncident()
    {
        var command = new CreateIncidentCommand(
            LotId: Guid.NewGuid(),
            ActorId: Guid.NewGuid(),
            Request: new CreateIncidentRequestDto(
                Title: "Kẹt barrier cổng vào G1",
                Type: "GATE_FAILURE",
                Severity: "High",
                Description: "Barrier không thể nâng tự động khi quẹt thẻ.",
                DetectedAt: DateTimeOffset.UtcNow),
            IdempotencyKey: "key-inc-01");

        var result = _createIncidentValidator.TestValidate(command);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void CreateIncidentValidator_ShouldFail_WhenRequiredFieldsMissingOrInvalidSeverity()
    {
        var command = new CreateIncidentCommand(
            LotId: Guid.Empty,
            ActorId: Guid.Empty,
            Request: new CreateIncidentRequestDto(
                Title: "",
                Type: "",
                Severity: "Extreme", // Invalid severity
                Description: "",
                DetectedAt: default),
            IdempotencyKey: null);

        var result = _createIncidentValidator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.LotId);
        result.ShouldHaveValidationErrorFor(x => x.ActorId);
        result.ShouldHaveValidationErrorFor(x => x.Request.Title);
        result.ShouldHaveValidationErrorFor(x => x.Request.Type);
        result.ShouldHaveValidationErrorFor(x => x.Request.Severity);
        result.ShouldHaveValidationErrorFor(x => x.Request.Description);
    }

    [Fact]
    public void UpdateIncidentStatusValidator_ShouldPass_ForValidStatusAndVersion()
    {
        var command = new UpdateIncidentStatusCommand(
            LotId: Guid.NewGuid(),
            IncidentId: Guid.NewGuid(),
            ActorId: Guid.NewGuid(),
            Request: new UpdateIncidentStatusRequestDto("InProgress", "Đang cử kỹ thuật kiểm tra", 1));

        var result = _updateIncidentStatusValidator.TestValidate(command);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void UpdateIncidentStatusValidator_ShouldFail_ForInvalidStatusOrZeroVersion()
    {
        var command = new UpdateIncidentStatusCommand(
            LotId: Guid.NewGuid(),
            IncidentId: Guid.NewGuid(),
            ActorId: Guid.NewGuid(),
            Request: new UpdateIncidentStatusRequestDto("Pending", null, 0));

        var result = _updateIncidentStatusValidator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Request.Status);
        result.ShouldHaveValidationErrorFor(x => x.Request.ExpectedVersion);
    }

    [Fact]
    public void CreateIncidentDecisionValidator_ShouldFail_WhenApprovedWithoutEvidence()
    {
        var command = new CreateIncidentDecisionCommand(
            LotId: Guid.NewGuid(),
            IncidentId: Guid.NewGuid(),
            ActorId: Guid.NewGuid(),
            Request: new CreateIncidentDecisionRequestDto(
                Decision: "Approved",
                Reason: "Duyệt xuất bãi do mất vé",
                Evidence: new List<IncidentEvidenceDto>(), // Empty evidence!
                ExpectedVersion: 1));

        var result = _decisionValidator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Request.Evidence);
    }

    [Fact]
    public void CreateIncidentDecisionValidator_ShouldPass_WhenApprovedWithEvidence()
    {
        var command = new CreateIncidentDecisionCommand(
            LotId: Guid.NewGuid(),
            IncidentId: Guid.NewGuid(),
            ActorId: Guid.NewGuid(),
            Request: new CreateIncidentDecisionRequestDto(
                Decision: "Approved",
                Reason: "Duyệt xuất bãi sau khi đối chiếu giấy tờ đăng ký xe",
                Evidence: new List<IncidentEvidenceDto>
                {
                    new("CAMERA", "https://storage.local/cams/gate-g1.jpg", DateTimeOffset.UtcNow),
                    new("VEHICLE_REGISTRATION", "https://storage.local/docs/reg-51a.jpg", null)
                },
                ExpectedVersion: 1));

        var result = _decisionValidator.TestValidate(command);
        result.ShouldNotHaveAnyValidationErrors();
    }

    // ==========================================
    // 2. SHIFT HANDOVER VALIDATION TESTS
    // ==========================================

    [Fact]
    public void CreateShiftHandoverValidator_ShouldPass_ForValidHandover()
    {
        var senderId = Guid.NewGuid();
        var receiverId = Guid.NewGuid();

        var command = new CreateShiftHandoverCommand(
            LotId: Guid.NewGuid(),
            ActorId: senderId,
            Request: new CreateShiftHandoverRequestDto(
                SenderShiftId: Guid.NewGuid(),
                ReceiverShiftId: Guid.NewGuid(),
                ReceiverUserId: receiverId,
                CompletedTasks: "Kiểm tra cổng và hệ thống camera",
                UnresolvedIssues: "Không có sự cố phát sinh",
                PendingTransactions: "Không có",
                EquipmentStatus: "Bình thường",
                NotesForNext: "Bàn giao chìa khóa tủ điện"),
            IdempotencyKey: "key-handover-01");

        var result = _createHandoverValidator.TestValidate(command);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void CreateShiftHandoverValidator_ShouldFail_WhenSelfHandover_SenderEqualsReceiver()
    {
        var userId = Guid.NewGuid();

        var command = new CreateShiftHandoverCommand(
            LotId: Guid.NewGuid(),
            ActorId: userId,
            Request: new CreateShiftHandoverRequestDto(
                SenderShiftId: Guid.NewGuid(),
                ReceiverShiftId: Guid.NewGuid(),
                ReceiverUserId: userId, // Self-handover: forbidden!
                CompletedTasks: "Nhiệm vụ",
                UnresolvedIssues: "Sự cố",
                PendingTransactions: "Tiền mặt",
                EquipmentStatus: null,
                NotesForNext: "Ghi chú"),
            IdempotencyKey: null);

        var result = _createHandoverValidator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Request.ReceiverUserId)
            .WithErrorMessage("Người bàn giao và người nhận ca không được là cùng một người (không tự giao tự nhận).");
    }

    [Fact]
    public void ConfirmShiftHandoverValidator_ShouldFail_WhenVersionZeroOrNegative()
    {
        var command = new ConfirmShiftHandoverCommand(
            LotId: Guid.NewGuid(),
            HandoverId: Guid.NewGuid(),
            ActorId: Guid.NewGuid(),
            Request: new ConfirmShiftHandoverRequestDto(ExpectedVersion: 0),
            IdempotencyKey: null);

        var result = _confirmHandoverValidator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Request.ExpectedVersion);
    }

    // ==========================================
    // 3. HANDLER & FACILITY ACCESS RBAC TESTS
    // ==========================================

    [Fact]
    public async Task IncidentCommandHandler_ShouldEnforceFacilityAccess_AndCallRepository()
    {
        var lotId = Guid.NewGuid();
        var actorId = Guid.NewGuid();
        var access = new StubFacilityAccess { AllowAccess = true };
        var repo = new StubIncidentsRepository();
        var handlers = new IncidentCommandHandlers(repo, access);

        var command = new CreateIncidentCommand(
            lotId, actorId,
            new CreateIncidentRequestDto("Lỗi rào chắn", "GATE", "Low", "Mô tả", DateTimeOffset.UtcNow),
            "key-123");

        var response = await handlers.Handle(command, CancellationToken.None);

        Assert.NotNull(response);
        Assert.Equal("INCIDENT_WRITE", access.LastCheckedCapability);
        Assert.True(repo.CreateIncidentCalled);
    }

    [Fact]
    public async Task IncidentCommandHandler_ShouldThrow403_WhenAccessDenied()
    {
        var access = new StubFacilityAccess { AllowAccess = false };
        var repo = new StubIncidentsRepository();
        var handlers = new IncidentCommandHandlers(repo, access);

        var command = new CreateIncidentCommand(
            Guid.NewGuid(), Guid.NewGuid(),
            new CreateIncidentRequestDto("Lỗi rào chắn", "GATE", "Low", "Mô tả", DateTimeOffset.UtcNow),
            "key-123");

        var ex = await Assert.ThrowsAsync<ServiceException>(() => handlers.Handle(command, CancellationToken.None));
        Assert.Equal(403, ex.StatusCode);
    }

    [Fact]
    public async Task ShiftHandoverCommandHandler_ShouldEnforceHandoverCapability()
    {
        var lotId = Guid.NewGuid();
        var actorId = Guid.NewGuid();
        var access = new StubFacilityAccess { AllowAccess = true };
        var repo = new StubIncidentsRepository();
        var handlers = new ShiftHandoverCommandHandlers(repo, access);

        var command = new ConfirmShiftHandoverCommand(
            lotId, Guid.NewGuid(), actorId,
            new ConfirmShiftHandoverRequestDto(1), "key-confirm");

        var response = await handlers.Handle(command, CancellationToken.None);

        Assert.NotNull(response);
        Assert.Equal("HANDOVER", access.LastCheckedCapability);
        Assert.True(repo.ConfirmHandoverCalled);
    }

    [Theory]
    [InlineData("Escalated")]
    [InlineData("Resolved")]
    public void UpdateIncidentStatusValidator_ShouldFail_WhenEscalatedOrResolvedWithoutNotes(string targetStatus)
    {
        var command = new UpdateIncidentStatusCommand(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(),
            new UpdateIncidentStatusRequestDto(Status: targetStatus, Notes: "   ", ExpectedVersion: 1));

        var result = _updateIncidentStatusValidator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Request.Notes);
    }

    [Fact]
    public void CreateIncidentDecisionValidator_ShouldFail_WhenApprovedLacksRequiredOrUsesBase64Evidence()
    {
        var missingDoc = new CreateIncidentDecisionCommand(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(),
            new CreateIncidentDecisionRequestDto(
                Decision: "Approved",
                Reason: "Chỉ có ảnh camera",
                Evidence: new[]
                {
                    new IncidentEvidenceDto("CAMERA", "https://cdn.example.com/cam-1.jpg", DateTimeOffset.UtcNow)
                },
                ExpectedVersion: 1));

        Assert.False(_decisionValidator.TestValidate(missingDoc).IsValid);

        var base64Ref = new CreateIncidentDecisionCommand(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(),
            new CreateIncidentDecisionRequestDto(
                Decision: "Approved",
                Reason: "Đính kèm base64",
                Evidence: new[]
                {
                    new IncidentEvidenceDto("CAMERA", "data:image/png;base64,AAAA", DateTimeOffset.UtcNow),
                    new IncidentEvidenceDto("VEHICLE_DOCUMENT", "https://cdn.example.com/doc.pdf", null)
                },
                ExpectedVersion: 1));

        Assert.False(_decisionValidator.TestValidate(base64Ref).IsValid);
    }

    [Fact]
    public void ListIncidentsQueryValidator_ShouldFail_WhenFromIsGreaterOrEqualToTo()
    {
        var anchor = DateTimeOffset.UtcNow;
        var validator = new ListIncidentsQueryValidator();

        var equalQuery = new ListIncidentsQuery(Guid.NewGuid(), Guid.NewGuid(), null, null, null, 1, 20, anchor, anchor);
        Assert.False(validator.TestValidate(equalQuery).IsValid);

        var reversedQuery = new ListIncidentsQuery(Guid.NewGuid(), Guid.NewGuid(), null, null, null, 1, 20, anchor.AddMinutes(5), anchor);
        Assert.False(validator.TestValidate(reversedQuery).IsValid);
    }

    [Fact]
    public async Task IncidentCommandHandler_ResolveIncident_ShouldRequireManagerCapability()
    {
        var lotId = Guid.NewGuid();
        var incidentId = Guid.NewGuid();
        var actorId = Guid.NewGuid();
        var access = new StubFacilityAccess { AllowAccess = true };
        access.DeniedCapabilities.Add("MANAGER");
        var repo = new StubIncidentsRepository();
        var handlers = new IncidentCommandHandlers(repo, access);

        var resolveCmd = new UpdateIncidentStatusCommand(
            lotId, incidentId, actorId,
            new UpdateIncidentStatusRequestDto("Resolved", "Đã xử lý xong", 1));

        var ex = await Assert.ThrowsAsync<ServiceException>(() => handlers.Handle(resolveCmd, CancellationToken.None));
        Assert.Equal(403, ex.StatusCode);
        Assert.False(repo.UpdateIncidentStatusCalled);
        Assert.Equal(new[] { "INCIDENT_WRITE", "MANAGER" }, access.CheckedCapabilities);

        access.CheckedCapabilities.Clear();
        var escalateCmd = new UpdateIncidentStatusCommand(
            lotId, incidentId, actorId,
            new UpdateIncidentStatusRequestDto("Escalated", "Cần quản lý xem xét", 1));
        var escalated = await handlers.Handle(escalateCmd, CancellationToken.None);
        Assert.Equal("Escalated", escalated.Status);
        Assert.Equal(new[] { "INCIDENT_WRITE" }, access.CheckedCapabilities);

        access.CheckedCapabilities.Clear();
        access.DeniedCapabilities.Clear();
        var ok = await handlers.Handle(resolveCmd, CancellationToken.None);
        Assert.Equal("Resolved", ok.Status);
        Assert.True(repo.UpdateIncidentStatusCalled);
        Assert.Equal(new[] { "INCIDENT_WRITE", "MANAGER" }, access.CheckedCapabilities);
    }

    [Fact]
    public async Task ShiftHandoverQueryHandler_ShouldEnforceFacilityManagerCapabilityAndIgnoreClaimFlag()
    {
        var lotId = Guid.NewGuid();
        var handoverId = Guid.NewGuid();
        var actorId = Guid.NewGuid();
        var access = new StubFacilityAccess { AllowAccess = true };
        access.DeniedCapabilities.Add("MANAGER");
        var repo = new StubIncidentsRepository();
        var handlers = new ShiftHandoverQueryHandlers(repo, access);

        await handlers.Handle(new ListShiftHandoversQuery(lotId, actorId, IsManager: true, null, 1, 20), CancellationToken.None);
        Assert.False(repo.LastListHandoversIsManager);

        await handlers.Handle(new GetShiftHandoverByIdQuery(lotId, handoverId, actorId, IsManager: true), CancellationToken.None);
        Assert.False(repo.LastGetHandoverIsManager);

        access.DeniedCapabilities.Clear();
        await handlers.Handle(new ListShiftHandoversQuery(lotId, actorId, IsManager: false, null, 1, 20), CancellationToken.None);
        Assert.True(repo.LastListHandoversIsManager);
    }

    [Fact]
    public async Task ShiftHandoverQueryHandler_ShouldPropagate503_WhenManagerCapabilityCheckUnavailable()
    {
        var access = new StubFacilityAccess { AllowAccess = true, Throw503OnCapabilityCheck = true };
        var repo = new StubIncidentsRepository();
        var handlers = new ShiftHandoverQueryHandlers(repo, access);

        var ex = await Assert.ThrowsAsync<ServiceException>(() =>
            handlers.Handle(new ListShiftHandoversQuery(Guid.NewGuid(), Guid.NewGuid(), true, null, 1, 20), CancellationToken.None));
        Assert.Equal(503, ex.StatusCode);
    }

    [Fact]
    public async Task GetShiftHandoverHistoryQueryHandler_ShouldRequireHandoverAccess_AndForwardManagerFlag()
    {
        var access = new StubFacilityAccess { AllowAccess = true };
        access.DeniedCapabilities.Add("MANAGER");
        var repo = new StubIncidentsRepository();
        var handlers = new ShiftHandoverQueryHandlers(repo, access);
        var lotId = Guid.NewGuid();
        var handoverId = Guid.NewGuid();
        var actorId = Guid.NewGuid();

        var result = await handlers.Handle(
            new GetShiftHandoverHistoryQuery(lotId, handoverId, actorId, 1, 10),
            CancellationToken.None);

        Assert.Contains("HANDOVER", access.CheckedCapabilities);
        Assert.Contains("MANAGER", access.CheckedCapabilities);
        Assert.False(repo.LastHistoryHandoverIsManager);
        Assert.Single(result.Items);
        Assert.Equal(handoverId, result.Items[0].HandoverId);
    }

    // ==========================================
    // TEST DOUBLES / STUBS
    // ==========================================

    private sealed class StubFacilityAccess : IFacilityAccess
    {
        public bool AllowAccess { get; set; } = true;
        public bool Throw503OnCapabilityCheck { get; set; }
        public HashSet<string> DeniedCapabilities { get; } = new(StringComparer.OrdinalIgnoreCase);
        public List<string> CheckedCapabilities { get; } = new();
        public string? LastCheckedCapability { get; private set; }

        public Task RequireAsync(Guid actorId, Guid lotId, string capability, CancellationToken ct)
        {
            LastCheckedCapability = capability;
            CheckedCapabilities.Add(capability);
            if (Throw503OnCapabilityCheck && string.Equals(capability, "MANAGER", StringComparison.OrdinalIgnoreCase))
                throw new ServiceException(503, "Identity service unavailable");
            if (!AllowAccess || DeniedCapabilities.Contains(capability))
                throw new ServiceException(403, $"Staff denied for {capability}");
            return Task.CompletedTask;
        }
    }

    private sealed class StubIncidentsRepository : IParkingRepository
    {
        public bool CreateIncidentCalled { get; private set; }
        public bool UpdateIncidentStatusCalled { get; private set; }
        public bool ConfirmHandoverCalled { get; private set; }
        public bool? LastListHandoversIsManager { get; private set; }
        public bool? LastGetHandoverIsManager { get; private set; }
        public bool? LastHistoryHandoverIsManager { get; private set; }

        public Task<IncidentDto> CreateIncidentAsync(Guid lotId, Guid actorId, CreateIncidentRequestDto request, string? key, CancellationToken ct)
        {
            CreateIncidentCalled = true;
            return Task.FromResult(new IncidentDto(
                IncidentId: Guid.NewGuid(),
                LotId: lotId,
                Title: request.Title,
                Type: request.Type,
                Severity: request.Severity,
                Description: request.Description,
                Status: "Open",
                ReportedByUserId: actorId,
                DetectedAt: request.DetectedAt,
                ReportedAt: DateTimeOffset.UtcNow,
                UpdatedAt: DateTimeOffset.UtcNow,
                ResolvedAt: null,
                LateReportReason: null,
                RelatedPlate: null,
                RelatedSlotCode: null,
                RelatedGate: null,
                RelatedBookingId: null,
                RelatedSessionId: null,
                Evidence: Array.Empty<IncidentEvidenceDto>(),
                ExitDecision: null,
                Version: 1));
        }

        public Task<ShiftHandoverDto> ConfirmShiftHandoverAsync(Guid lotId, Guid handoverId, Guid actorId, ConfirmShiftHandoverRequestDto request, string? key, CancellationToken ct)
        {
            ConfirmHandoverCalled = true;
            return Task.FromResult(new ShiftHandoverDto(
                HandoverId: handoverId,
                LotId: lotId,
                SenderShiftId: Guid.NewGuid(),
                ReceiverShiftId: Guid.NewGuid(),
                SenderUserId: Guid.NewGuid(),
                ReceiverUserId: actorId,
                CompletedTasks: "Done",
                UnresolvedIssues: "None",
                PendingTransactions: "None",
                EquipmentStatus: "OK",
                NotesForNext: "None",
                Status: "Confirmed",
                CreatedAt: DateTimeOffset.UtcNow.AddHours(-1),
                ConfirmedAt: DateTimeOffset.UtcNow,
                ConfirmedByUserId: actorId,
                Version: 2));
        }

        public Task<PagedResult<IncidentSummaryDto>> ListIncidentsAsync(Guid lotId, string? status, string? severity, string? query, int page, int pageSize, CancellationToken ct) => throw new NotImplementedException();
        public Task<IncidentDto?> GetIncidentByIdAsync(Guid lotId, Guid incidentId, CancellationToken ct) => throw new NotImplementedException();
        public Task<IncidentDto> UpdateIncidentStatusAsync(Guid lotId, Guid incidentId, Guid actorId, UpdateIncidentStatusRequestDto request, CancellationToken ct)
        {
            UpdateIncidentStatusCalled = true;
            return Task.FromResult(new IncidentDto(
                IncidentId: incidentId,
                LotId: lotId,
                Title: "Incident",
                Type: "GATE",
                Severity: "High",
                Description: "Details",
                Status: request.Status,
                ReportedByUserId: actorId,
                DetectedAt: DateTimeOffset.UtcNow.AddMinutes(-10),
                ReportedAt: DateTimeOffset.UtcNow.AddMinutes(-9),
                UpdatedAt: DateTimeOffset.UtcNow,
                ResolvedAt: request.Status == "Resolved" ? DateTimeOffset.UtcNow : null,
                LateReportReason: null,
                RelatedPlate: null,
                RelatedSlotCode: null,
                RelatedGate: null,
                RelatedBookingId: null,
                RelatedSessionId: null,
                Evidence: Array.Empty<IncidentEvidenceDto>(),
                ExitDecision: null,
                Version: request.ExpectedVersion + 1));
        }
        public Task<PagedResult<IncidentHistoryItemDto>> GetIncidentHistoryAsync(Guid lotId, Guid incidentId, int page, int pageSize, CancellationToken ct) => throw new NotImplementedException();
        public Task<IncidentDto> ReopenIncidentAsync(Guid lotId, Guid incidentId, Guid actorId, ReopenIncidentRequestDto request, CancellationToken ct) => throw new NotImplementedException();
        public Task<IncidentDto> CancelIncidentAsync(Guid lotId, Guid incidentId, Guid actorId, CancelIncidentRequestDto request, CancellationToken ct) => throw new NotImplementedException();
        public Task<IncidentExitDecisionDto> CreateIncidentDecisionAsync(Guid lotId, Guid incidentId, Guid actorId, CreateIncidentDecisionRequestDto request, CancellationToken ct) => throw new NotImplementedException();
        public Task<ShiftHandoverDto> CreateShiftHandoverAsync(Guid lotId, Guid actorId, CreateShiftHandoverRequestDto request, string? key, CancellationToken ct) => throw new NotImplementedException();
        public Task<PagedResult<ShiftHandoverSummaryDto>> ListShiftHandoversAsync(Guid lotId, Guid actorId, bool isManager, string? status, int page, int pageSize, CancellationToken ct)
        {
            LastListHandoversIsManager = isManager;
            return Task.FromResult(new PagedResult<ShiftHandoverSummaryDto>(Array.Empty<ShiftHandoverSummaryDto>(), page, pageSize, 0));
        }
        public Task<ShiftHandoverDto?> GetShiftHandoverByIdAsync(Guid lotId, Guid handoverId, Guid actorId, bool isManager, CancellationToken ct)
        {
            LastGetHandoverIsManager = isManager;
            return Task.FromResult<ShiftHandoverDto?>(new ShiftHandoverDto(
                HandoverId: handoverId,
                LotId: lotId,
                SenderShiftId: Guid.NewGuid(),
                ReceiverShiftId: Guid.NewGuid(),
                SenderUserId: Guid.NewGuid(),
                ReceiverUserId: actorId,
                CompletedTasks: "Done",
                UnresolvedIssues: "None",
                PendingTransactions: "None",
                EquipmentStatus: "OK",
                NotesForNext: "None",
                Status: "PendingConfirmation",
                CreatedAt: DateTimeOffset.UtcNow.AddHours(-1),
                ConfirmedAt: null,
                ConfirmedByUserId: null,
                Version: 1));
        }
        public Task<PagedResult<ShiftHandoverHistoryItemDto>> GetShiftHandoverHistoryAsync(Guid lotId, Guid handoverId, Guid actorId, bool isManager, int page, int pageSize, CancellationToken ct)
        {
            LastHistoryHandoverIsManager = isManager;
            var item = new ShiftHandoverHistoryItemDto(
                Id: Guid.NewGuid(),
                HandoverId: handoverId,
                LotId: lotId,
                Action: "CREATED",
                OldReceiverUserId: null,
                NewReceiverUserId: actorId,
                PerformedByUserId: actorId,
                Reason: "Khởi tạo biên bản bàn giao ca",
                PerformedAt: DateTimeOffset.UtcNow.AddMinutes(-15));
            return Task.FromResult(new PagedResult<ShiftHandoverHistoryItemDto>([item], page, pageSize, 1));
        }
        public Task<ShiftHandoverDto> ReassignReceiverAsync(Guid lotId, Guid handoverId, Guid actorId, ReassignReceiverRequestDto request, CancellationToken ct) => throw new NotImplementedException();

        // Baseline methods
        public Task<IReadOnlyList<LotView>> ListLotsAsync(CancellationToken ct) => throw new NotImplementedException();
        public Task<bool> LotExistsAsync(Guid lotId, CancellationToken ct) => throw new NotImplementedException();
        public Task<BookingView> CreateBookingAsync(Guid customerId, BookingRequest request, string key, CancellationToken ct) => throw new NotImplementedException();
        public Task<LotAvailabilityDto> GetLotAvailabilityAsync(Guid lotId, DateTimeOffset? startTime, DateTimeOffset? endTime, string? vehicleType, Guid? levelId, CancellationToken ct) => throw new NotImplementedException();
        public Task<(BookingDetailDto Detail, Guid? CustomerId, Guid LotId)?> GetBookingDetailAsync(Guid bookingId, CancellationToken ct) => throw new NotImplementedException();
        public Task<int> ExpireHoldsAsync(CancellationToken ct) => throw new NotImplementedException();
        public Task<BookingQrContextDto?> GetBookingQrContextAsync(Guid bookingId, CancellationToken ct) => throw new NotImplementedException();
        public Task SaveIssuedQrTokenAsync(Guid bookingId, Guid expectedLotId, Guid expectedVehicleId, GeneratedQrToken token, CancellationToken ct) => throw new NotImplementedException();
        public Task<CheckInResponseDto> CheckInAsync(Guid actorId, CheckInRequestDto request, ValidatedQrToken token, string key, CancellationToken ct) => throw new NotImplementedException();
        public Task<CheckInResponseDto> CheckInWalkInAsync(Guid actorId, CheckInRequestDto request, string key, CancellationToken ct) => throw new NotImplementedException();
        public Task<CheckOutQuoteResultDto> GetCheckOutQuoteAsync(Guid lotId, Guid gateId, string detectedPlate, string? qrPayload, CancellationToken ct, Guid? sessionId = null) => throw new NotImplementedException();
        public Task<ConfirmCheckOutResultDto?> GetCheckOutReplayAsync(Guid actorId, ConfirmCheckOutRequestDto request, string key, CancellationToken ct) => throw new NotImplementedException();
        public Task RecordCheckOutMismatchAsync(Guid sessionId, Guid actorId, string observedPlate, CancellationToken ct) => throw new NotImplementedException();
        public Task<AuthorizeCheckOutResultDto?> ClaimCheckOutAuthorizationAsync(Guid actorId, ConfirmCheckOutRequestDto request, string key, CancellationToken ct) => throw new NotImplementedException();
        public Task<AuthorizeCheckOutResultDto> SaveCheckOutAuthorizationAsync(Guid actorId, ConfirmCheckOutRequestDto request, string key, AuthorizeCheckOutResultDto result, CancellationToken ct) => throw new NotImplementedException();
        public Task<Guid?> GetSessionLotIdAsync(Guid sessionId, CancellationToken ct) => throw new NotImplementedException();
        public Task<ConfirmCheckOutResultDto> CompleteCheckOutAsync(Guid actorId, ConfirmCheckOutRequestDto request, string key, CancellationToken ct, CheckOutVerification? verification = null) => throw new NotImplementedException();
    }
}
