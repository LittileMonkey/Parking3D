using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Payment.Application.DTOs
{
    public record PaymentStatusDto
    {
        public Guid BookingId { get; init; }
        public Guid PaymentId { get; init; }
        public string PaymentMethod { get; init; } = "CASH";
        public string PaymentStatus { get; init; } = "Pending";
        public decimal TotalAmount { get; init; }
        public string Currency { get; init; } = "VND";
        public DateTime LastUpdatedAt { get; init; }
    }
}
