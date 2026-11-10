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
            var bookingStatus = paymentStatus switch
            {
                "SUCCESS" => "CONFIRMED",
                "PENDING" => "PENDING_PAYMENT",
                _ => "CANCELLED"
            };
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
            const string sql = """
                                SELECT 
                                    p.id,
                                    a.booking_id,
                                    a.session_id,
                                    a.lot_id,
                                    a.vehicle_id,
                                    a.lot_name,
                                    a.plate_number,
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
                                WHERE (p.id = @paymentId OR a.booking_id = @paymentId OR a.session_id = @paymentId)
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
            var bookingId = reader.IsDBNull(1) ? (Guid?)null : reader.GetGuid(1);
            var sessionId = reader.IsDBNull(2) ? (Guid?)null : reader.GetGuid(2);
            var lotId = reader.GetGuid(3);
            var vehicleId = reader.GetGuid(4);

            // Đọc Snapshot: Nếu bản ghi cũ chưa có snapshot thì fallback về mã dễ nhìn
            var lotNameSnapshot = reader.IsDBNull(5) ? null : reader.GetString(5);
            var lotName = !string.IsNullOrWhiteSpace(lotNameSnapshot) ? lotNameSnapshot : $"Bãi đỗ xe #{lotId.ToString()[..8].ToUpper()}";
            var plateSnapshot = reader.IsDBNull(6) ? null : reader.GetString(6);
            var plateNumber = !string.IsNullOrWhiteSpace(plateSnapshot) ? plateSnapshot : (vehicleId != Guid.Empty ? $"Xe #{vehicleId.ToString()[..6].ToUpper()}" : "Xe vãng lai");

            var amount = reader.GetDecimal(7);
            var currency = reader.GetString(8);
            var method = reader.GetString(9);
            var status = reader.GetString(10);
            var paidAt = new DateTimeOffset(reader.GetDateTime(11), TimeSpan.Zero);
            var collectedBy = reader.IsDBNull(12) ? (Guid?)null : reader.GetGuid(12);
            var bankTransactionNo = reader.IsDBNull(13) ? null : reader.GetString(13);

            // Tạo mã biên lai chuẩn REC-YYYYMMDD-XXXXXX
            var receiptNumber = $"REC-{paidAt:yyyyMMdd}-{id.ToString("N")[..6].ToUpper()}";

            // Chuẩn hóa chuỗi raw hash: lấy bookingId hoặc sessionId hoặc id thanh toán
            var referenceId = bookingId ?? sessionId ?? id;
            var rawHashInput = $"{receiptNumber}|{id}|{referenceId}|{amount:0}|{currency}|{paidAt:O}";
            var verificationHash = Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(rawHashInput)));

            return new EReceiptDto(
                ReceiptNumber: receiptNumber,
                PaymentId: id,
                BookingId: bookingId,
                SessionId: sessionId,
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


        public async Task<PaymentAuthCheckDto?> GetPaymentForAuthCheckAsync(Guid paymentId, CancellationToken ct = default)
        {
            const string sql = """
                SELECT 
                    p.id, 
                    a.lot_id, 
                    a.booking_id, 
                    p.status::text, 
                    p.method::text, 
                    p.collected_by,
                    COALESCE(
                        a.customer_id, 
                        (SELECT actor_user_id FROM audit_logs WHERE entity_id = p.id::text AND action = 'CREATE_PAYMENT' LIMIT 1)
                    ) AS customer_id
                FROM payments p
                JOIN billing_accounts a ON a.id = p.account_id
                WHERE p.id = @paymentId OR a.booking_id = @paymentId
                LIMIT 1;
                """;

            await using var cmd = _db.CreateCommand(sql);
            cmd.Parameters.AddWithValue("paymentId", paymentId);
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            if (!await reader.ReadAsync(ct))
            {
                return null;
            }

            return new PaymentAuthCheckDto(
                PaymentId: reader.GetGuid(0),
                LotId: reader.GetGuid(1),
                BookingId: reader.IsDBNull(2) ? null : reader.GetGuid(2),
                Status: reader.GetString(3),
                Method: reader.GetString(4),
                CollectedBy: reader.IsDBNull(5) ? null : reader.GetGuid(5),
                CustomerId: reader.IsDBNull(6) ? null : reader.GetGuid(6)
            );
        }
    }
}
