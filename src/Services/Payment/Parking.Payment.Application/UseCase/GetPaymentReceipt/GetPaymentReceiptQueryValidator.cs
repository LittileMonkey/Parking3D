using FluentValidation;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Payment.Application.UseCase.GetPaymentReceipt
{
    /// <summary>
    /// Bộ kiểm tra tính hợp lệ của PaymentId trước khi tra cứu hóa đơn.
    /// </summary>
    public class GetPaymentReceiptQueryValidator : AbstractValidator<GetPaymentReceiptQuery>
    {
        public GetPaymentReceiptQueryValidator()
        {
            RuleFor(x => x.PaymentId)
                .NotEmpty()
                .WithMessage("Mã thanh toán (PaymentId) không được để trống.");
        }
    }
}
