using FluentValidation;

namespace Parking.Parking.Application.Features.CheckOut.Commands;

/// <summary>
/// Validator kiểm tra tính hợp lệ của lệnh xác nhận check-out.
/// </summary>
public sealed class ConfirmCheckOutCommandValidator : AbstractValidator<ConfirmCheckOutCommand>
{
    public ConfirmCheckOutCommandValidator()
    {
        RuleFor(x => x.ActorId).NotEmpty().WithMessage("ActorId is required.");
        RuleFor(x => x.Request.SessionId).NotEmpty().WithMessage("SessionId is required.");
        RuleFor(x => x.Request.GateId).NotEmpty().WithMessage("GateId is required.");
        RuleFor(x => x.Request.PaymentMethod)
            .NotEmpty()
            .Must(m => m is "NONE" or "CASH" or "VNPAY_QR" or "PREPAID")
            .WithMessage("PaymentMethod must be NONE, CASH, VNPAY_QR or PREPAID.");
        RuleFor(x => x.Request.CashReceived)
            .GreaterThanOrEqualTo(0)
            .WithMessage("CashReceived must be greater than or equal to 0.");
        RuleFor(x => x.IdempotencyKey)
            .NotEmpty()
            .MaximumLength(128)
            .WithMessage("Valid Idempotency-Key is required.");
    }
}
