using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Payment.Domain.Enums
{
    public enum PaymentStatus
    {
        PENDING = 1,
        SUCCESS = 2,
        FAILED = 3,
        PARTIALLY_REFUNDED = 4,
        REFUNDED = 5,
        RECONCILIATION_REQUIRED = 6

    }
}
