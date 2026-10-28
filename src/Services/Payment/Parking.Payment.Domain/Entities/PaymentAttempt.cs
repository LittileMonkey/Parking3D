using Parking.Payment.Domain.Base;
using Parking.Payment.Domain.Enums;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Payment.Domain.Entities
{
    public class PaymentAttempt : BaseEntity
    {
        /// <summary>
        /// Khóa ngoại liên kết tới Payment cha.
        /// </summary>
        public Guid PaymentId { get; set; }
        /// <summary>
        /// Nhà cung cấp cổng thanh toán (VD: "VNPAY").
        /// </summary>
        public string Provider { get; set; } = "VNPAY";
        /// <summary>
        /// Mã tham chiếu giao dịch gửi sang VNPay (vnp_TxnRef).
        /// </summary>
        public string MerchantReference { get; set; } = string.Empty;
        /// <summary>
        /// Mã giao dịch do VNPay phản hồi về sau khi khách thanh toán thành công (vnp_TransactionNo).
        /// </summary>
        public string? ProviderTransactionId { get; set; }
        /// <summary>
        /// Trạng thái của lần thử (INITIATED, SUCCESS, FAILED, TIMEOUT).
        /// </summary>
        public PaymentAttemptStatus Status { get; set; } = PaymentAttemptStatus.INITIATED;
        /// <summary>
        /// Thời điểm khởi tạo yêu cầu gửi sang cổng VNPay.
        /// </summary>
        public DateTimeOffset RequestedAt { get; set; } = DateTimeOffset.UtcNow;
        /// <summary>
        /// Thời điểm nhận phản hồi kết thúc giao dịch từ VNPay.
        /// </summary>
        public DateTimeOffset? CompletedAt { get; set; }
        /// <summary>
        /// Mã phản hồi lỗi từ VNPay (VD: "00" = Thành công, "24" = Khách hủy giao dịch).
        /// </summary>
        public string? ResponseCode { get; set; }
        #region Domain Methods
        /// <summary>
        /// Đánh dấu lần thử thành công khi Webhook IPN hợp lệ.
        /// </summary>
        public void MarkSuccess(string providerTxnId)
        {
            Status = PaymentAttemptStatus.SUCCESS;
            ProviderTransactionId = providerTxnId;
            CompletedAt = DateTimeOffset.UtcNow;
            UpdatedAt = DateTimeOffset.UtcNow;
        }
        /// <summary>
        /// Đánh dấu lần thử thất bại khi khách hủy hoặc thẻ lỗi.
        /// </summary>
        public void MarkFailed(string responseCode)
        {
            Status = PaymentAttemptStatus.FAILED;
            ResponseCode = responseCode;
            CompletedAt = DateTimeOffset.UtcNow;
            UpdatedAt = DateTimeOffset.UtcNow;
        }
        #endregion
    }
}
