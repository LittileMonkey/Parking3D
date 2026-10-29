using Parking.Payment.Domain.Base;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Payment.Domain.Entities
{
    public class BillingAccount : BaseEntity
    {
        /// <summary>
        /// Bãi đỗ xe phát sinh giao dịch tính cước.
        /// </summary>
        public Guid LotId { get; set; }
        /// <summary>
        /// Phương tiện đỗ xe (nếu có).
        /// </summary>
        public Guid? VehicleId { get; set; }
        /// <summary>
        /// Mã đơn đặt chỗ trước (BookingId) được thanh toán.
        /// </summary>
        public Guid? BookingId { get; set; }
        /// <summary>
        /// Mã phiên đỗ xe thực tế (SessionId) tại bãi.
        /// </summary>
        public Guid? SessionId { get; set; }
        /// <summary>
        /// Đơn vị tiền tệ (Mặc định: "VND").
        /// </summary>
        public string Currency { get; set; } = "VND";
    }
}
