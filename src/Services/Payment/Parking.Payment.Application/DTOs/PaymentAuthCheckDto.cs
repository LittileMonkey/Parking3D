using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Payment.Application.DTOs
{
    public record PaymentAuthCheckDto(
           Guid PaymentId,
           Guid LotId,
           Guid? BookingId,
           string Status,
           string Method,
           Guid? CollectedBy,
           Guid? CustomerId
       );
}
