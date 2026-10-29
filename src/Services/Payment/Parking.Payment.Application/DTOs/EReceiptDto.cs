using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Payment.Application.DTOs
{
    /// <summary>
    /// DTO chứa thông tin biên lai điện tử (E-Receipt) sau khi thanh toán hoàn tất.
    /// </summary>
    public record EReceiptDto(
        string ReceiptNumber,
        Guid PaymentId,
        Guid BookingId,
        string LotName,
        string PlateNumber,
        string PaymentMethod,
        decimal TotalAmount,
        string Currency,
        DateTimeOffset PaidAt,
        string? CollectedByStaff,
        string? BankTransactionNo,
        string VerificationHash

    );

}
