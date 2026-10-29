using MediatR;
using Parking.Payment.Application.DTOs;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Payment.Application.UseCase.GetPaymentReceipt
{
    /// <summary>
    /// Query tra cứu hóa đơn điện tử (E-Receipt) theo PaymentId.
    /// </summary>
    public record GetPaymentReceiptQuery(Guid PaymentId) : IRequest<EReceiptDto?>;

}
