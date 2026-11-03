using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Payment.Application.DTOs
{
    /// <summary>
    /// Kết quả phản hồi sau khi nhân viên bốt xác nhận thu tiền mặt thành công.
    /// </summary>
    public record ConfirmCashPaymentResultDto
    {
        public Guid PaymentId { get; init; }
        public Guid BookingId { get; init; }
        public string Status { get; init; } = "SUCCESS";

        // Trả về User ID thật của nhân viên thu tiền (từ Token Claims), không trả giả lập staff_01
        public string ConfirmedBy { get; init; } = string.Empty;
        public DateTimeOffset ConfirmedAt { get; init; }

    }
}
