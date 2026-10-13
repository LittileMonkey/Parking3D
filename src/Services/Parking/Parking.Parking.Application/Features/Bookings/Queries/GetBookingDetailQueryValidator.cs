using FluentValidation;

namespace Parking.Parking.Application.Features.Bookings.Queries;

// Kiểm tra tính hợp lệ tham số đầu vào cho query chi tiết booking
public class GetBookingDetailQueryValidator : AbstractValidator<GetBookingDetailQuery>
{
    public GetBookingDetailQueryValidator()
    {
        RuleFor(x => x.BookingId)
            .NotEmpty()
            .WithMessage("BookingId không được để trống.");

        RuleFor(x => x.RequestingUserId)
            .NotEmpty()
            .WithMessage("RequestingUserId không được để trống.");
    }
}
