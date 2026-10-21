using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Payment.Infrastructure.Configuration
{
    /// <summary>
    /// Cấu hình kết nối cổng thanh toán VNPay từ appsettings.json.
    /// </summary>
    public class VnPaySettings
    {
        /// <summary>Mã định danh Merchant do VNPay cấp.</summary>
        public string TmnCode { get; set; } = string.Empty;
        /// <summary>Khóa bí mật tạo chữ ký số HMAC-SHA512.</summary>
        public string HashSecret { get; set; } = string.Empty;
        /// <summary>URL cổng thanh toán VNPay (Sandbox / Production).</summary>
        public string BaseUrl { get; set; } = string.Empty;
        public string Version { get; set; } = "2.1.0";
        public string Command { get; set; } = "pay";
        public string CurrCode { get; set; } = "VND";
        public string Locale { get; set; } = "vn";
        /// <summary>URL chuyển hướng trình duyệt của khách hàng sau khi thanh toán.</summary>
        public string ReturnUrl { get; set; } = string.Empty;
        /// <summary>URL Webhook IPN nhận thông báo ngầm từ server VNPay.</summary>
        public string IpnUrl { get; set; } = string.Empty;
    }
}
