using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Payment.Application.DTOs
{
    public record ConfirmCashPaymentResultDto
    {
        public Guid PaymentId { get; init; }
        public string Status { get; init; } = "Success";
        public string ComfirmedBy { get; init; } = string.Empty;
        public DateTime ComfirmedAt { get; init; } 

    }
}
