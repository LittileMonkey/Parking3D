using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Payment.Application.DTOs
{
    public record ConfirmCashPaymentRequestDto
    {
        public Guid BookingId { get; init; }
        public string StaffReason { get; init; } = string.Empty;
        public int Version { get; init; }

    }
}
