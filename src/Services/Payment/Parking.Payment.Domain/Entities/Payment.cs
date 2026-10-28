using Parking.Payment.Domain.Base;
using Parking.Payment.Domain.Enums;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Payment.Domain.Entities
{
    public class Payment : BaseEntity
    {
        /// <summary>
        /// Khóa ngoại liên kết tới tài khoản tính cước (billing_accounts).
        /// </summary>
        public Guid AccountId { get; set; }
        /// <summary>
        /// Số tiền cần thanh toán (tính theo đơn vị tiền tệ nhỏ nhất, ví dụ VNĐ).
        /// </summary>
        public decimal Amount { get; set; }
        /// <summary>
        /// Phương thức thanh toán (CASH = Tiền mặt, VNPAY = Trực tuyến).
        /// </summary>
        public PaymentMethod Method { get; set; }
        /// <summary>
        /// Trạng thái thanh toán (PENDING, SUCCESS, FAILED, REFUNDED...).
        /// </summary>
        public PaymentStatus Status { get; set; } = PaymentStatus.PENDING;
        /// <summary>
        /// Khóa chống trùng lặp yêu cầu thanh toán (Idempotency Key).
        /// </summary>
        public string? IdempotencyKey { get; set; }
        /// <summary>
        /// Nhân viên xác nhận thu tiền mặt tại bốt (Staff UserId).
        /// </summary>
        public Guid? CollectedBy { get; set; }
        /// <summary>
        /// Thời điểm thanh toán thành công thực tế.
        /// </summary>
        public DateTimeOffset? SucceededAt { get; set; }


        #region Domain Logic / Business Methods (Quy tắc nghiệp vụ bảo vệ thanh toán)
        /// <summary>
        /// Nghiệp vụ S2-06: Nhân viên quầy xác nhận đã thu đủ tiền mặt từ khách.
        /// Bảo vệ chống: Thu 2 lần (409), Sai phương thức (400), Tranh chấp đồng thời (422).
        /// </summary>
        public void ConfirmCash(Guid staffId, int expectedVersion)
        {
            // 1. Kiểm tra trạng thái: Không được thu tiền một đơn đã thành công
            if (Status == PaymentStatus.SUCCESS)
                throw new InvalidOperationException("Hóa đơn này đã được xác nhận thanh toán trước đó.");
            // 2. Kiểm tra phương thức: Chỉ có đơn CASH mới được xác nhận tại quầy
            if (Method != PaymentMethod.CASH)
                throw new InvalidOperationException("Chỉ có giao dịch bằng Tiền Mặt (CASH) mới được phép xác nhận tại quầy.");
            // 3. Kiểm tra khóa lạc quan (Optimistic Concurrency Check)
            if (Version != expectedVersion)
                throw new InvalidOperationException("Dữ liệu thanh toán đã bị thay đổi bởi người khác. Vui lòng tải lại trang.");

            // 4. Cập nhật trạng thái thành công
            Status = PaymentStatus.SUCCESS;
            CollectedBy = staffId;
            SucceededAt = DateTimeOffset.UtcNow;
            UpdatedAt = DateTimeOffset.UtcNow;
            Version++;

        }


        /// <summary>
        /// Nghiệp vụ SCRUM-56: Cổng VNPay gửi Webhook IPN báo thanh toán trực tuyến thành công.
        /// </summary>
        public void ProcessVnPaySuccess(long amountMinor)
        {
            if (Status == PaymentStatus.SUCCESS)
                return; // Idempotent: Đã xử lý rồi thì bỏ qua an toàn
            if ((long)Amount != amountMinor)
                throw new InvalidOperationException($"Số tiền VNPay báo về ({amountMinor}) không khớp với hóa đơn ({Amount}).");
            Status = PaymentStatus.SUCCESS;
            SucceededAt = DateTimeOffset.UtcNow;
            UpdatedAt = DateTimeOffset.UtcNow;
            Version++;
        }


        /// <summary>
        /// Nghiệp vụ SCRUM-56: VNPay báo giao dịch không thành công.
        /// Vẫn giữ Status là PENDING để khách hàng có thể bấm quét mã lại (Retry).
        /// </summary>
        public void ProcessVnPayFailure()
        {
            UpdatedAt = DateTimeOffset.UtcNow;
        }



        #endregion
    }
}
