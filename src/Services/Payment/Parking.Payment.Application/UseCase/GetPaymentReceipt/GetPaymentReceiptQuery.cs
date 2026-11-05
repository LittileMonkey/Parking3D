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
    /// Query tra cứu và in hóa đơn điện tử (E-Receipt) theo PaymentId kèm định danh người yêu cầu đã qua xác thực.
    /// </summary>
    public record GetPaymentReceiptQuery(Guid PaymentId, Guid RequestingUserId = default) : IRequest<EReceiptDto?>;

}
