using FluentValidation;

namespace Parking.Parking.Application.Features.CheckOut.Queries;

/// <summary>
/// Validator kiểm tra tính hợp lệ của yêu cầu tra cứu cước check-out.
/// </summary>
public sealed class GetCheckOutQuoteQueryValidator : AbstractValidator<GetCheckOutQuoteQuery>
{
    public GetCheckOutQuoteQueryValidator()
    {
        RuleFor(x => x.ActorId).NotEmpty().WithMessage("ActorId is required.");
        RuleFor(x => x.Request.LotId).NotEmpty().WithMessage("LotId is required.");
        RuleFor(x => x.Request.GateId).NotEmpty().WithMessage("GateId is required.");
        RuleFor(x => x.Request.DetectedPlate)
            .NotEmpty()
            .When(x => string.IsNullOrWhiteSpace(x.Request.QrPayload))
            .WithMessage("DetectedPlate or QrPayload is required for check-out identification.");
    }
}
