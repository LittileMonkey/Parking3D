using MediatR;
using Parking.Payment.Application.DTOs;
using Parking.Payment.Application.Interfaces;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Payment.Application.UseCase.GetPaymentStatus
{
    public class GetPaymentStatusQueryHandler : IRequestHandler<GetPaymentStatusQuery, PaymentStatusDto?>
                                                                // TRequest              TResponse
    {
        private readonly IPaymentService _paymentService;
        public GetPaymentStatusQueryHandler(IPaymentService paymentService)
        {
            _paymentService = paymentService;
        }

        public async Task<PaymentStatusDto?> Handle(GetPaymentStatusQuery request, CancellationToken cancellationToken)
        {
            return await _paymentService.GetPaymentStatusByBookingIdAsync(request.BookingId, cancellationToken);
        }
    }
}
