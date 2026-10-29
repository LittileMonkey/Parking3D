using Parking.Payment.Application.DTOs;
using Parking.Payment.Application.UseCase.ConfirmCashPayment;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Payment.Application.Interfaces
{

    /// <summary>
    /// Hợp đồng dịch vụ xử lý quy trình khởi tạo và xác nhận thanh toán.
    /// </summary>
    public interface IPaymentService
    {
        /// <summary>
        /// Khởi tạo lượt thanh toán (CASH hoặc VNPAY) cho đơn đặt chỗ.
        /// </summary>
        Task<PaymentView> CreateAsync(Guid user, CreatePaymentRequest request, string key, CancellationToken ct, string? ipAddress = null);


        /// <summary>
        /// Nhân viên xác nhận thu tiền mặt tại bãi xe.
        /// </summary>
        Task<PaymentView> ConfirmCashAsync(Guid actor, Guid lot, Guid payment, CashConfirmationRequest request, CancellationToken ct);

        /// <summary>
        /// Nghiệp vụ SCRUM-95: Nhân viên xác nhận thu tiền mặt theo BookingId.
        /// Xác thực quyền qua gRPC Identity (BR-01), chống Double Effect và ghi Outbox an toàn.
        /// </summary>
        Task<ConfirmCashPaymentResultDto> ConfirmCashPaymentAsync(ConfirmCashPaymentCommand command, CancellationToken ct);

        /// <summary>
        /// Xử lý callback IPN từ VNPay, xác thực bảo mật và cập nhật trạng thái giao dịch.
        /// </summary>
        Task<VnPayIpnResult> HandleVnPayIpnAsync(IDictionary<string, string> queryParams, CancellationToken ct);

        /// <summary>
        /// Xử lý ReturnUrl từ VNPay (trình duyệt redirect về sau khi khách hàng thanh toán).
        /// Chỉ đọc kết quả, không ghi DB (IPN đã làm việc đó trước rồi).
        /// </summary>
        Task<VnPayReturnResult> HandleVnPayReturnAsync(IDictionary<string, string> queryParams, CancellationToken ct);
    }
}
