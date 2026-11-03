using FluentValidation;

namespace Parking.Parking.Application.Features.Bookings.Commands;

// Kiểm tra ID đầu vào trước khi xác minh quyền và trạng thái booking.
public sealed class IssueBookingQrCommandValidator
    : AbstractValidator<IssueBookingQrCommand>
{
    /// <summary>Yêu cầu ID booking và người gọi khác rỗng trước khi xử lý cấp QR.</summary>
    public IssueBookingQrCommandValidator()
    {
        RuleFor(x => x.BookingId)
            .NotEmpty()
            .WithMessage("BookingId không được để trống.");

        RuleFor(x => x.RequestingUserId)
            .NotEmpty()
            .WithMessage("Danh tính người yêu cầu không hợp lệ.");
    }
}