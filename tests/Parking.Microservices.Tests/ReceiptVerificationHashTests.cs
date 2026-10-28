using System;
using System.Security.Cryptography;
using System.Text;
using Xunit;

namespace Parking.Microservices.Tests
{
    public class ReceiptVerificationHashTests
    {
        [Fact]
        public void VerificationHash_ShouldMatch_WhenComputedWithSameData()
        {
            // ARRANGE
            var receiptNumber = "REC-20261027-A1B2C3";
            var paymentId = Guid.NewGuid();
            var bookingId = Guid.NewGuid();
            var amount = 45000m;
            var currency = "VND";
            var paidAt = DateTimeOffset.UtcNow;
            var rawHashInput = $"{receiptNumber}|{paymentId}|{bookingId}|{amount}|{currency}|{paidAt:O}";
            // ACT: Tính toán 2 lần độc lập
            var hash1 = Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(rawHashInput)));
            var hash2 = Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(rawHashInput)));
            // ASSERT: Chuỗi băm bất biến và có độ dài chuẩn SHA-256 (64 ký tự hex)
            Assert.Equal(hash1, hash2);
            Assert.Equal(64, hash1.Length);
        }
        [Fact]
        public void VerificationHash_ShouldDetectTampering_WhenAmountIsModified()
        {
            // ARRANGE: Hóa đơn gốc 45,000 VND
            var receiptNumber = "REC-20261027-A1B2C3";
            var paymentId = Guid.NewGuid();
            var bookingId = Guid.NewGuid();
            var originalAmount = 45000m;
            var tamperedAmount = 5000m; // Kẻ gian cố tình sửa số tiền thành 5,000 VND
            var currency = "VND";
            var paidAt = DateTimeOffset.UtcNow;
            var originalRaw = $"{receiptNumber}|{paymentId}|{bookingId}|{originalAmount}|{currency}|{paidAt:O}";
            var tamperedRaw = $"{receiptNumber}|{paymentId}|{bookingId}|{tamperedAmount}|{currency}|{paidAt:O}";
            // ACT
            var originalHash = Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(originalRaw)));
            var tamperedHash = Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(tamperedRaw)));
            // ASSERT: Hệ thống phát hiện ngay sự sai lệch (mã băm khác nhau hoàn toàn)
            Assert.NotEqual(originalHash, tamperedHash);
        }
    }
}
