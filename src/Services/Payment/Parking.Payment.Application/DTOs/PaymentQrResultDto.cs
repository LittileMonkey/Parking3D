using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Payment.Application.DTOs
{
    public record PaymentQrResultDto(
        Guid PaymentId,
        Guid BookingId,
        Decimal Amount,
        string Currency,
        string MerchantTxnRef,
        string PaymentUrl,
        string QrPayload,
        DateTimeOffset ExpiresAt
    );
    
    
}
