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
            .Must(m => m is "NONE" or "CASH" or "VNPAY_QR")
            .WithMessage("PaymentMethod must be NONE, CASH or VNPAY_QR.");
        RuleFor(x => x.Request.DetectedPlate).NotEmpty().MaximumLength(20);
        RuleFor(x => x.Request.QuoteToken).NotEmpty().MaximumLength(8192);
        RuleFor(x => x.Request.ExitPermitToken).NotEmpty().MaximumLength(8192);
        RuleFor(x => x.Request.StaffObservedExit).Equal(true)
            .WithMessage("Staff must confirm that the vehicle physically left the lot.");
        RuleFor(x => x.Request.StaffNotes).NotEmpty().MaximumLength(2000)
            .When(x => x.Request.PaymentMethod == "CASH");
        RuleFor(x => x.Request.PaymentReference).NotEmpty().MaximumLength(128)
            .When(x => x.Request.PaymentMethod == "VNPAY_QR");
        RuleFor(x => x.Request.CashReceived)
            .GreaterThanOrEqualTo(0)
            .WithMessage("CashReceived must be greater than or equal to 0.");
        RuleFor(x => x.IdempotencyKey)
            .NotEmpty()
            .MaximumLength(128)
            .WithMessage("Valid Idempotency-Key is required.");
    }
}
