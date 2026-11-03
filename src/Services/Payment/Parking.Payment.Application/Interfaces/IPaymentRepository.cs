using Parking.Payment.Application.DTOs;
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

        /// <summary>
        /// Tra cứu và khởi tạo thông tin biên lai điện tử (E-Receipt) kèm mã băm SHA-256 đối soát.
        /// </summary>
        Task<EReceiptDto?> GetReceiptAsync(Guid paymentId, CancellationToken cancellationToken = default);
    }
}
