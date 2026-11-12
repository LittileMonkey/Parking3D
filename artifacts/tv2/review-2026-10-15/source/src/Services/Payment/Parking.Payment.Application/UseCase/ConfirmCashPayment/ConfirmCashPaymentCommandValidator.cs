using FluentValidation;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Payment.Application.UseCase.ConfirmCashPayment
{
    public class ConfirmCashPaymentCommandValidator : AbstractValidator<ConfirmCashPaymentCommand>
    {
        public ConfirmCashPaymentCommandValidator()
        {
            RuleFor(x => x.BookingID).NotEmpty().WithMessage("Mã đặt chỗ (BookingId) không được để trống.");

            RuleFor(x => x.StaffReason)
                .NotEmpty()
                .WithMessage("Lý do xác nhận thu tiền mặt không được để trống.")
                .MaximumLength(500)
                .WithMessage("Lý do không được vượt quá 500 ký tự.");
            RuleFor(x => x.Version)
                .GreaterThanOrEqualTo(1)
                .WithMessage("Phiên bản (Version) phải lớn hơn hoặc bằng 1.");
            RuleFor(x => x.ConfirmedBy)
                .NotEmpty()
                .WithMessage("Thông tin nhân viên xác nhận không hợp lệ.");
        }
    }
}
