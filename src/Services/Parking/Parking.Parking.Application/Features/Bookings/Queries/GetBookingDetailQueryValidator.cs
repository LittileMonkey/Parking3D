using FluentValidation;

namespace Parking.Parking.Application.Features.Bookings.Queries;

// Kiểm tra tính hợp lệ tham số đầu vào cho query chi tiết booking
// Kiểm tra mã booking và người gọi trước khi đọc thông tin riêng tư.
public class GetBookingDetailQueryValidator : AbstractValidator<GetBookingDetailQuery>
{
    /// <summary>Yêu cầu mã booking và danh tính người gọi hợp lệ trước bước đọc dữ liệu riêng tư.</summary>
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
