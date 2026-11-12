using FluentValidation;
using Parking.Parking.Domain;

namespace Parking.Parking.Application.Features.Bookings.Commands;

// Kiểm tra input trước khi MediatR gọi handler.
public sealed class CheckInCommandValidator : AbstractValidator<CheckInCommand>
{
    /// <summary>Kiểm tra actor, bãi, cổng, payload, biển số và khóa chống request trùng trước Handler.</summary>
    public CheckInCommandValidator()
    {
        RuleFor(x => x.ActorId).NotEmpty();
        RuleFor(x => x.IdempotencyKey).NotEmpty().MaximumLength(128);
        RuleFor(x => x.Request).NotNull();
        When(x => x.Request is not null, () =>
        {
            RuleFor(x => x.Request.LotId).NotEmpty();
            RuleFor(x => x.Request.GateId).NotEmpty();
            RuleFor(x => x.Request.DetectedPlate)
                .Must(value => PlateNumber.TryNormalize(value, out _))
                .WithMessage("A valid observed vehicle plate is required.");
            When(x => !string.IsNullOrEmpty(x.Request.QrPayload), () =>
            {
                RuleFor(x => x.Request.QrPayload!)
                    .Must(payload => !string.IsNullOrWhiteSpace(payload))
                    .WithMessage("QR payload cannot be whitespace.")
                    .MaximumLength(2048);
            });
            When(x => !string.IsNullOrWhiteSpace(x.Request.VehicleType), () =>
            {
                RuleFor(x => x.Request.VehicleType!)
                    .Must(type => type.Trim().ToUpperInvariant() is "CAR" or "MOTORBIKE")
                    .WithMessage("VehicleType must be CAR or MOTORBIKE.");
            });
            When(x => x.Request.AllowMismatchOverride, () =>
            {
                RuleFor(x => x.Request.OverrideReason)
                    .NotEmpty()
                    .WithMessage("Override reason is required when plate mismatch is overridden.")
                    .MaximumLength(500);
            });
        });
    }
}
