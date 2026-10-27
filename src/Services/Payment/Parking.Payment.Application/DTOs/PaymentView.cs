using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Payment.Application.DTOs
{

    /// <summary>
    /// Dữ liệu phản hồi trạng thái thanh toán, kèm link chuyển hướng cổng thanh toán trực tuyến nếu có.
    /// </summary>
    public sealed record PaymentView(
        Guid Id,
        Guid LotId,
        Guid BookingId,
        long Amount,
        string Currency,
        string Method,
        string Status,
        int Version,
        string? PaymentUrl = null);
}
