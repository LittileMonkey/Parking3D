using Parking.Payment.Application.DTOs;
using Parking.Payment.Application.UseCase.ConfirmCashPayment;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Payment.Application.Interfaces
{
    public interface IPaymentRepository
    {
        Task<PaymentStatusDto?> GetPaymentStatusByBookingIdAsync(Guid bookingId, CancellationToken cancellationToken = default);

        Task<ConfirmCashPaymentResultDto> ConfirmCashPaymentAsync(ConfirmCashPaymentCommand command, CancellationToken cancellationToken = default);
    }
}
