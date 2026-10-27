using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Payment.Application.DTOs
{

    /// <summary>
    /// Yêu cầu tạo mới một lượt thanh toán cho đơn đặt chỗ.
    /// </summary>
    public sealed record CreatePaymentRequest(Guid BookingId, string Method);

}
