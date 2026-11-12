using Parking.Payment.Application.DTOs;
using Parking.Payment.Application.Interfaces;
using Parking.Payment.Application.UseCase.ConfirmCashPayment;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using static System.Runtime.InteropServices.JavaScript.JSType;

namespace Parking.Payment.Infrastructure.Repositories
{
    internal class PaymentRepository : IPaymentRepository
    {


        public Task<ConfirmCashPaymentResultDto> ConfirmCashPaymentAsync(ConfirmCashPaymentCommand command, CancellationToken cancellationToken = default)
        {
            // Dữ liệu phản hồi chuẩn theo tài liệu S2-06:
            // { "paymentId": "...", "status": "Success", "confirmedBy": "...", "confirmedAt": "..." }

            var result = new ConfirmCashPaymentResultDto
            {
                PaymentId = Guid.NewGuid(),
                Status = "Success",
                ComfirmedBy = command.ConfirmedBy,
                ComfirmedAt = DateTime.UtcNow
            };
            return Task.FromResult(result);
        }

        public Task<PaymentStatusDto?> GetPaymentStatusByBookingIdAsync(Guid bookingId, CancellationToken cancellationToken = default)
        {
          // Data giả lập chuẩn theo tài liệu S2 - 06(45.000 VNĐ, tiền mặt CASH, Pending)
        // Khi nào nối database thật, bạn chỉ cần thay đoạn này bằng SQL query!
        var mockStatus = new PaymentStatusDto
        {
            BookingId = bookingId,
            PaymentId = Guid.NewGuid(),
            PaymentMethod = "CASH",
            PaymentStatus = "Pending",
            TotalAmount = 45000,
            Currency = "VND",
            LastUpdatedAt = DateTime.UtcNow
        };
            return Task.FromResult<PaymentStatusDto?>(mockStatus);

        }
    }
}
