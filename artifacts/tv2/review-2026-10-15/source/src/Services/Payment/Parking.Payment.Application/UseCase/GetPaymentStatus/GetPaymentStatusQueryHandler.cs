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
        private readonly IPaymentRepository _paymentRepository;
        public GetPaymentStatusQueryHandler(IPaymentRepository paymentRepository)
        {
            _paymentRepository = paymentRepository;
        }

        public async Task<PaymentStatusDto?> Handle(GetPaymentStatusQuery request, CancellationToken cancellationToken)
        {
            // Gọi xuống Repository lấy dữ liệu
            return await _paymentRepository.GetPaymentStatusByBookingIdAsync(request.BookingId, cancellationToken);
        }
    }
}
