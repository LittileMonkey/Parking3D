using FluentValidation;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Payment.Application.UseCase.CreatePaymentQrCommand
{
    /// <summary>
    /// Bộ kiểm tra tính hợp lệ dữ liệu đầu vào của CreatePaymentQrCommand.
    /// </summary>

    public  class CreatePaymentQrCommandValidator : AbstractValidator<CreatePaymentQrCommand>
    {
        public CreatePaymentQrCommandValidator()
        {
            RuleFor(x => x.BookingId)
                .NotEmpty()
                .WithMessage("Mã đơn đặt chỗ (BookingId) không được để trống.");
            RuleFor(x => x.UserId)
                .NotEmpty()
                .WithMessage("Mã người dùng (UserId) không được để trống.");
        }
    }
}
