using Npgsql;
using Parking.Payment.Application.DTOs;
using Parking.Payment.Application.Interfaces;
using Parking.Payment.Application.UseCase.ConfirmCashPayment;
using Parking.Payment.Domain.Enums;
using Parking.ServiceDefaults;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using static System.Runtime.InteropServices.JavaScript.JSType;
using PaymentEntity = Parking.Payment.Domain.Entities.Payment;

namespace Parking.Payment.Infrastructure.Repositories
{
    internal class PaymentRepository : IPaymentRepository
    {
        private readonly NpgsqlDataSource _db;
        public PaymentRepository(NpgsqlDataSource db)
        {
            _db = db;
        }



        /// <summary>
        /// Tra cứu trạng thái thanh toán theo BookingId từ CSDL.
        /// Phân định rõ 3 trạng thái độc lập: PaymentStatus, BookingStatus và SessionStatus.
        /// </summary>
        public async Task<PaymentStatusDto?> GetPaymentStatusByBookingIdAsync(Guid bookingId, CancellationToken cancellationToken = default)
        {
            const string sql = """
                SELECT 
                    a.booking_id,
                    p.id AS payment_id,
                    p.method::text AS payment_method,
                    p.status::text AS payment_status,
                    p.amount AS total_amount,
                    a.currency,
                    COALESCE(p.succeeded_at, p.created_at) AS last_updated_at,
                    a.session_id
                FROM payments p
                JOIN billing_accounts a ON a.id = p.account_id
                WHERE a.booking_id = @bookingId
                ORDER BY p.created_at DESC
                LIMIT 1;
                """;
            await using var cmd = _db.CreateCommand(sql);
            cmd.Parameters.AddWithValue("bookingId", bookingId);
            await using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
            if (!await reader.ReadAsync(cancellationToken))
            {
                return null;
            }
            var paymentStatus = reader.GetString(3);
            var isSessionPresent = !reader.IsDBNull(7);
            // 1. BookingStatus: Phụ thuộc vào kết quả thanh toán theo mô hình Vé Trả Trước
            // - Đã thu tiền thành công (SUCCESS) -> Giữ chỗ chính thức (CONFIRMED)
            // - Đang chờ thanh toán -> Đang giữ chỗ tạm thời 15p (PENDING_PAYMENT)
            // - Thất bại hoặc hết hạn -> Đã hủy (CANCELLED)
            var bookingStatus = paymentStatus switch
            {
                "SUCCESS" => "CONFIRMED",
                "PENDING" => "PENDING_PAYMENT",
                _ => "CANCELLED"
            };
            // 2. SessionStatus: Phụ thuộc vào việc xe đã check-in qua cổng bãi chưa
            // - billing_accounts.session_id có giá trị -> Xe đã quét mã vào bãi (ACTIVE)
            // - billing_accounts.session_id là NULL -> Xe chưa tới cổng bãi (NOT_CHECKED_IN)
            var sessionStatus = isSessionPresent ? "ACTIVE" : "NOT_CHECKED_IN";
            return new PaymentStatusDto
            {
                BookingId = reader.GetGuid(0),
                PaymentId = reader.GetGuid(1),
                PaymentMethod = reader.GetString(2),
                PaymentStatus = paymentStatus,
                BookingStatus = bookingStatus,
                SessionStatus = sessionStatus,
                TotalAmount = reader.GetDecimal(4),
                Currency = reader.GetString(5),
                LastUpdatedAt = reader.GetDateTime(6)
            };
        }
        public async Task<EReceiptDto?> GetReceiptAsync(Guid paymentId, CancellationToken cancellationToken = default)
        {
            {
                const string sql = """
                SELECT 
                    p.id,
                    a.booking_id,
                    a.lot_id,
                    a.vehicle_id,
                    p.amount,
                    a.currency,
                    p.method::text,
                    p.status::text,
                    COALESCE(p.succeeded_at, p.created_at) AS paid_at,
                    p.collected_by,
                    pa.provider_transaction_id
                FROM payments p
                JOIN billing_accounts a ON a.id = p.account_id
                LEFT JOIN payment_attempts pa ON pa.payment_id = p.id AND pa.status = 'SUCCESS'
                WHERE p.id = @paymentId
                ORDER BY pa.completed_at DESC NULLS LAST
                LIMIT 1;
                """;
                await using var cmd = _db.CreateCommand(sql);
                cmd.Parameters.AddWithValue("paymentId", paymentId);
                await using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
                if (!await reader.ReadAsync(cancellationToken))
                {
                    return null;
                }
                var id = reader.GetGuid(0);
                var bookingId = reader.GetGuid(1);
                var lotId = reader.GetGuid(2);
                var vehicleId = reader.GetGuid(3);
                var amount = reader.GetDecimal(4);
                var currency = reader.GetString(5);
                var method = reader.GetString(6);
                var status = reader.GetString(7);
                var paidAt = new DateTimeOffset(reader.GetDateTime(8), TimeSpan.Zero);
                var collectedBy = reader.IsDBNull(9) ? (Guid?)null : reader.GetGuid(9);
                var bankTransactionNo = reader.IsDBNull(10) ? null : reader.GetString(10);
                // 1. Sinh số hóa đơn chuẩn: REC-YYYYMMDD-6KÝTỰCUỐI
                var receiptNumber = $"REC-{paidAt:yyyyMMdd}-{id.ToString("N")[..6].ToUpper()}";
                var lotName = $"Bãi đỗ xe #{lotId.ToString()[..8].ToUpper()}";
                var plateNumber = vehicleId != Guid.Empty ? $"30H-{vehicleId.ToString()[..4].ToUpper()}" : "Xe khách hàng";
                // 2. Tính mã băm bảo mật SHA-256 đối soát (VerificationHash)
                // Ghép chuỗi các thông tin bất biến của hóa đơn để phát hiện nếu biên lai bị sửa số tiền hoặc thông tin
                var rawHashInput = $"{receiptNumber}|{id}|{bookingId}|{amount}|{currency}|{paidAt:O}";
                var verificationHash = Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(rawHashInput)));
                // 3. Trả về DTO hoàn chỉnh
                return new EReceiptDto(
                    ReceiptNumber: receiptNumber,
                    PaymentId: id,
                    BookingId: bookingId,
                    LotName: lotName,
                    PlateNumber: plateNumber,
                    PaymentMethod: method,
                    TotalAmount: amount,
                    Currency: currency,
                    PaidAt: paidAt,
                    CollectedByStaff: collectedBy?.ToString(),
                    BankTransactionNo: bankTransactionNo,
                    VerificationHash: verificationHash
                );
            }
        }
    }
}
