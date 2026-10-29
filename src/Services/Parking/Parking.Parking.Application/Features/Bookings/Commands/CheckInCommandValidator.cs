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
            RuleFor(x => x.Request.QrPayload).NotEmpty().MaximumLength(2048);
            RuleFor(x => x.Request.DetectedPlate)
                .Must(value => PlateNumber.TryNormalize(value, out _))
                .WithMessage("A valid observed vehicle plate is required.");
        });
    }
}
