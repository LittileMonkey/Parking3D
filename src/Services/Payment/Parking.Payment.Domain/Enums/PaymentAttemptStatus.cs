using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Payment.Domain.Enums
{
    public enum PaymentAttemptStatus
    {
        INITIATED = 1,
        SUCCESS = 2,
        FAILED = 3,
        TIMEOUT = 4
    }

}
