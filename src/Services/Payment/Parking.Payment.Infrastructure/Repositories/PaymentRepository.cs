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

        public async Task<ConfirmCashPaymentResultDto> ConfirmCashPaymentAsync(ConfirmCashPaymentCommand command, CancellationToken cancellationToken = default)
        {
            await using var conn = await _db.OpenConnectionAsync(cancellationToken);
            await using var tx = await conn.BeginTransactionAsync(cancellationToken);

            // 1. Tìm bản ghi payment và khóa dòng (FOR UPDATE) để chống xung đột đồng thời
            const string querySql = """
            SELECT p.id, a.lot_id, p.amount, a.currency, p.method::text, p.status::text, p.version
            FROM payments p
            JOIN billing_accounts a ON a.id = p.account_id
            WHERE a.booking_id = @bookingId
            FOR UPDATE OF p;
            """;

            Guid paymentId;
            Guid lotId;
            decimal amount;
            string currency;
            string method;
            string status;
            int version;

            await using (var queryCmd = new NpgsqlCommand(querySql, conn, tx))
            {
                queryCmd.Parameters.AddWithValue("bookingId", command.BookingId);
                await using var reader = await queryCmd.ExecuteReaderAsync(cancellationToken);
                if (!await reader.ReadAsync(cancellationToken))
                {
                    throw new ServiceException(404, "Payment record not found for the specified booking.");
                }
                paymentId = reader.GetGuid(0);
                lotId = reader.GetGuid(1);
                amount = reader.GetDecimal(2);
                currency = reader.GetString(3);
                method = reader.GetString(4);
                status = reader.GetString(5);
                version = reader.GetInt32(6);
            }
            // 2. TẠO THỰC THỂ PAYMENT VÀ ĐỂ ENTITY TỰ THỰC THI NGHIỆP VỤ (RICH DOMAIN MODEL)
            var payment = new PaymentEntity
            {
                Id = paymentId,
                Amount = amount,
                Method = Enum.Parse<PaymentMethod>(method, ignoreCase: true),
                Status = Enum.Parse<PaymentStatus>(status, ignoreCase: true),
                Version = version
            };
            var actorId = Guid.TryParse(command.ConfirmedBy, out var parsedGuid)
                ? parsedGuid
                : Guid.Parse("00000000-0000-0000-0000-000000000001");
            try
            {
                // Gọi chính phương thức nghiệp vụ của Entity để kiểm tra 3 mã lỗi (409, 400, 422)
                // và tự động chuyển Status = SUCCESS, Version = Version + 1, SucceededAt = now
                payment.ConfirmCash(actorId, command.Version);
            }
            catch (InvalidOperationException ex)
            {
                // Map thông báo lỗi từ Entity sang mã HTTP Status Code chuẩn cho API
                if (ex.Message.Contains("đã được xác nhận"))
                    throw new ServiceException(409, "Payment already confirmed.");
                if (ex.Message.Contains("Tiền Mặt"))
                    throw new ServiceException(400, "Only CASH payments can be confirmed at counter.");
                if (ex.Message.Contains("thay đổi"))
                    throw new ServiceException(422, "Concurrency conflict. Please refresh and try again.");
                throw new ServiceException(400, ex.Message);
            }
            // 3. Chuẩn bị dữ liệu ghi Outbox Event và Audit Log
            var now = payment.SucceededAt ?? DateTimeOffset.UtcNow;
            var eventId = Guid.NewGuid();
            var payloadJson = JsonSerializer.Serialize(new
            {
                eventId = eventId.ToString(),
                paymentId = payment.Id.ToString(),
                bookingId = command.BookingId.ToString(),
                lotId = lotId.ToString(),
                amountMinor = (long)payment.Amount,
                currency = currency,
                paidAtUnixSeconds = now.ToUnixTimeSeconds()
            });
            // 4. Lưu trạng thái mới CỦA CHÍNH ENTITY xuống Database
            const string updateSql = """
                UPDATE payments 
                SET status = @status::payment_status, succeeded_at = @now, collected_by = @actor, version = @version 
                WHERE id = @id;
                INSERT INTO integration_outbox(event_id, event_type, aggregate_id, payload) 
                VALUES(@event, 'PaymentSucceeded.v1', @id, @payload::jsonb);
                INSERT INTO audit_logs(id, lot_id, actor_user_id, actor_type, action, entity_type, entity_id, reason, created_at)
                VALUES(gen_random_uuid(), @lot, @actor, 'USER', 'CONFIRM_CASH', 'PAYMENT', @entity, @reason, now());
                """;
            await using (var updateCmd = new NpgsqlCommand(updateSql, conn, tx))
            {
                updateCmd.Parameters.AddWithValue("status", payment.Status.ToString());
                updateCmd.Parameters.AddWithValue("now", now.UtcDateTime);
                updateCmd.Parameters.AddWithValue("actor", payment.CollectedBy ?? actorId);
                updateCmd.Parameters.AddWithValue("version", payment.Version);
                updateCmd.Parameters.AddWithValue("id", payment.Id);
                updateCmd.Parameters.AddWithValue("event", eventId);
                updateCmd.Parameters.AddWithValue("payload", payloadJson);
                updateCmd.Parameters.AddWithValue("lot", lotId);
                updateCmd.Parameters.AddWithValue("entity", payment.Id.ToString());
                updateCmd.Parameters.AddWithValue("reason", command.StaffReason.Trim());
                await updateCmd.ExecuteNonQueryAsync(cancellationToken);
            }


            // 5. Commit toàn bộ Transaction
            await tx.CommitAsync(cancellationToken);
            // 6. Trả về kết quả DTO thành công
            return new ConfirmCashPaymentResultDto
            {
                PaymentId = paymentId,
                Status = "Success",
                ConfirmedBy = command.ConfirmedBy,
                ConfirmedAt = now.UtcDateTime
            };
        }


        //Lấy tính booking để xem thành trạng thanh toán
        public async Task<PaymentStatusDto?> GetPaymentStatusByBookingIdAsync(Guid bookingId, CancellationToken cancellationToken = default)
        {
            const string sql = """
                SELECT 
                    a.booking_id,
                    p.id,
                    p.method::text,
                    p.status::text,
                    p.amount,
                    a.currency,
                    COALESCE(p.succeeded_at, p.created_at) AS last_updated_at
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

            return new PaymentStatusDto
            {
                BookingId = reader.GetGuid(0),
                PaymentId = reader.GetGuid(1),
                PaymentMethod = reader.GetString(2),
                PaymentStatus = reader.GetString(3),
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
