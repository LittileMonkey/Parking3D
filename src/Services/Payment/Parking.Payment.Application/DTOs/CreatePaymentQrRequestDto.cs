using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Payment.Application.DTOs
{
    /// <summary>
    /// DTO tiếp nhận yêu cầu sinh mã VNPay-QR động từ Client (Frontend / Kiosk).
    /// </summary>
    public record CreatePaymentQrRequestDto(Guid BookingId);
}
