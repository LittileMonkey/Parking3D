using MediatR;
using Parking.Payment.Application.DTOs;
using Parking.Payment.Application.Interfaces;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Payment.Application.UseCase.GetPaymentReceipt
{
    /// <summary>
    /// Handler xử lý việc lấy dữ liệu hóa đơn điện tử từ IPaymentRepository.
    /// </summary>
    public class GetPaymentReceiptQueryHandler : IRequestHandler<GetPaymentReceiptQuery, EReceiptDto?>
    {
        private readonly IPaymentService _paymentService;

        public GetPaymentReceiptQueryHandler(IPaymentService paymentService)
        {
            _paymentService = paymentService;
        }

        public async Task<EReceiptDto?> Handle(GetPaymentReceiptQuery request, CancellationToken cancellationToken)
        {
            return await _paymentService.GetReceiptAsync(request.PaymentId, request.RequestingUserId, cancellationToken);
        }
    }

}
