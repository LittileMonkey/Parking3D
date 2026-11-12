using FluentValidation;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Payment.Application.UseCase.GetPaymentStatus
{
    public class GetPaymentStatusQueryValidator : AbstractValidator<GetPaymentStatusQuery>
    {
        public GetPaymentStatusQueryValidator()
        {
            RuleFor(x => x.BookingId)
                .NotEmpty()
                .WithMessage("Mã đặt chỗ (BookingId) không được để trống.");
        }
    }
}
