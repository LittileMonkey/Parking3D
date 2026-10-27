using Microsoft.Extensions.Options;
using Parking.Payment.Application.Interfaces;
using Parking.Payment.Infrastructure.Configuration;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Payment.Infrastructure.Services
{
    /// <summary>
    /// Dịch vụ tích hợp và xử lý mã hóa chữ ký số cho cổng thanh toán VNPay.
    /// </summary>
    public class VnPayService(IOptions<VnPaySettings> options) : IVnPayService
    {
        private readonly VnPaySettings _settings = options.Value;


        /// <summary>
        /// Bộ so sánh chuỗi theo bảng mã nhị phân ASCII từ A-Z theo quy chuẩn VNPay.
        /// </summary>
        private sealed class VnPayCompare : IComparer<string>
        {
            public int Compare(string? x, string? y)
            {
                if (x == y) return 0;
                if (x == null) return -1;
                if (y == null) return 1;
                return string.CompareOrdinal(x, y);
            }
        }

        /// <summary>
        /// Thuật toán mã hóa băm HMAC-SHA512 với khóa bí mật HashSecret.
        /// </summary>
        private static string HmacSha512(string key, string inputData)
        {
            using var hmac = new HMACSHA512(Encoding.UTF8.GetBytes(key));
            var hashValue = hmac.ComputeHash(Encoding.UTF8.GetBytes(inputData));
            return Convert.ToHexStringLower(hashValue);
        }



        /// <summary>
        /// Sinh URL thanh toán VNPay kèm chữ ký bảo mật HMAC-SHA512 (thời hạn 5 phút).
        /// </summary>
        public string CreatePaymentUrl(string transactionRef, long amountMinor, string orderInfo, string ipAddress)
        {
            var timeZone = TimeZoneInfo.TryFindSystemTimeZoneById("SE Asia Standard Time", out var tz) ? tz : TimeZoneInfo.FindSystemTimeZoneById("Asia/Ho_Chi_Minh");
            var timeNow = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, timeZone);

            var vnpParameters = new SortedList<string, string>(new VnPayCompare())
            {
                { "vnp_Version", _settings.Version },
                { "vnp_Command", _settings.Command },
                { "vnp_TmnCode", _settings.TmnCode },
                { "vnp_Amount", (amountMinor * 100).ToString() }, // VNPay quy định nhân 100
                { "vnp_CreateDate", timeNow.ToString("yyyyMMddHHmmss") },
                { "vnp_CurrCode", _settings.CurrCode },
                { "vnp_IpAddr", string.IsNullOrWhiteSpace(ipAddress) ? "127.0.0.1" : ipAddress },
                { "vnp_Locale", _settings.Locale },
                { "vnp_OrderInfo", orderInfo },
                { "vnp_OrderType", "other" },
                { "vnp_ReturnUrl", _settings.ReturnUrl },
                { "vnp_TxnRef", transactionRef },
                { "vnp_ExpireDate", timeNow.AddMinutes(5).ToString("yyyyMMddHHmmss") } // Khớp thời hạn giữ chỗ 5 phút
            };


            var queryString = new StringBuilder();
            var rawData = new StringBuilder();
            foreach (var (key, value) in vnpParameters)
            {
                if (string.IsNullOrEmpty(value)) continue;
                if (queryString.Length > 0)
                {
                    queryString.Append('&');
                    rawData.Append('&');
                }
                queryString.Append(WebUtility.UrlEncode(key)).Append('=').Append(WebUtility.UrlEncode(value));
                rawData.Append(WebUtility.UrlEncode(key)).Append('=').Append(WebUtility.UrlEncode(value));
            }
            var secureHash = HmacSha512(_settings.HashSecret, rawData.ToString());
            return $"{_settings.BaseUrl}?{queryString}&vnp_SecureHash={secureHash}";

        }



        /// <summary>
        /// Kiểm tra tính hợp lệ của chữ ký HMAC-SHA512 từ callback của VNPay.
        /// </summary>
        public bool ValidateSignature(IDictionary<string, string> queryParameters, string inputHash)
        {
            var rawData = new StringBuilder();

            // Lọc các param vnp_ và bỏ qua chữ ký cũ   
            var validParams = queryParameters
                .Where(kv => kv.Key.StartsWith("vnp_", StringComparison.OrdinalIgnoreCase)
                             && !kv.Key.Equals("vnp_SecureHash", StringComparison.OrdinalIgnoreCase)
                             && !kv.Key.Equals("vnp_SecureHashType", StringComparison.OrdinalIgnoreCase))
                .OrderBy(kv => kv.Key, new VnPayCompare());

            foreach (var (key, value) in validParams)
            {
                if (string.IsNullOrEmpty(value)) continue;
                if (rawData.Length > 0) rawData.Append('&');
                rawData.Append(WebUtility.UrlEncode(key)).Append('=').Append(WebUtility.UrlEncode(value));
            }
            var checkHash = HmacSha512(_settings.HashSecret, rawData.ToString());
            return string.Equals(checkHash, inputHash, StringComparison.OrdinalIgnoreCase);

        }


    }
}
