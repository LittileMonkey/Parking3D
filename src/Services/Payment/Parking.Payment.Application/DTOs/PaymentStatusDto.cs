using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Payment.Application.DTOs
{
    /// <summary>
    /// DTO tra cứu trạng thái thanh toán và tiến trình đỗ xe phân biệt: Tiền đã thu chưa, Chỗ đã giữ chưa, và Xe đã vào bãi chưa.
    /// </summary>
    public record PaymentStatusDto
    {
        public Guid BookingId { get; init; }
        public Guid PaymentId { get; init; }
        public string PaymentMethod { get; init; } = "CASH";
        // 1. Trạng thái thanh toán tiền bạc: PENDING, SUCCESS, FAILED
        public string PaymentStatus { get; init; } = "PENDING";
        // 2. Trạng thái giữ chỗ đặt trước: PENDING_PAYMENT, CONFIRMED, EXPIRED, CANCELLED
        public string BookingStatus { get; init; } = "PENDING_PAYMENT";
        // 3. Trạng thái vật lý của phương tiện: NOT_CHECKED_IN, ACTIVE, COMPLETED
        public string SessionStatus { get; init; } = "NOT_CHECKED_IN";
        public decimal TotalAmount { get; init; }
        public string Currency { get; init; } = "VND";
        public DateTime LastUpdatedAt { get; init; }
    }
}
