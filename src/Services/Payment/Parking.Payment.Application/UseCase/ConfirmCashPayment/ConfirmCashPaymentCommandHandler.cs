using MediatR;
using Parking.Payment.Application.DTOs;
using Parking.Payment.Application.Interfaces;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Payment.Application.UseCase.ConfirmCashPayment
{
    public class ConfirmCashPaymentCommandHandler : IRequestHandler<ConfirmCashPaymentCommand, ConfirmCashPaymentResultDto>
    {
        private readonly IPaymentService _paymentService;

        public ConfirmCashPaymentCommandHandler (IPaymentService paymentService)
        {
            _paymentService = paymentService;
        }

        public async Task<ConfirmCashPaymentResultDto> Handle(ConfirmCashPaymentCommand request, CancellationToken cancellationToken)
        {
            return await _paymentService.ConfirmCashPaymentAsync(request, cancellationToken);
        }
    }
}
