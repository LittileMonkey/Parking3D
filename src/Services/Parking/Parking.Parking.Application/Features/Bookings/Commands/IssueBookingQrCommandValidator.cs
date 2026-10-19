using FluentValidation;

namespace Parking.Parking.Application.Features.Bookings.Commands;

public sealed class IssueBookingQrCommandValidator
    : AbstractValidator<IssueBookingQrCommand>
{
    public IssueBookingQrCommandValidator()
    {
        RuleFor(x => x.BookingId)
            .NotEmpty()
            .WithMessage("BookingId is not Empty.");

        RuleFor(x => x.RequestingUserId)
            .NotEmpty()
            .WithMessage("The user's request is invalid..");
    }
}