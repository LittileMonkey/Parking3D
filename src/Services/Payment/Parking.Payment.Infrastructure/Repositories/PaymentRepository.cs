using Npgsql;
using Parking.Payment.Application.DTOs;
using Parking.Payment.Application.Interfaces;
using Parking.Payment.Application.UseCase.ConfirmCashPayment;
using Parking.ServiceDefaults;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using static System.Runtime.InteropServices.JavaScript.JSType;

namespace Parking.Payment.Infrastructure.Repositories
{
    internal class PaymentRepository : IPaymentRepository
    {
        private readonly NpgsqlDataSource _db;
        public PaymentRepository (NpgsqlDataSource db)
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
            // 2. Kiểm tra các điều kiện nghiệp vụ theo tài liệu thiết kế S2-06
            if (status == "SUCCESS")
            {
                throw new ServiceException(409, "Payment already confirmed.");
            }
            if (version != command.Version)
            {
                throw new ServiceException(422, "Concurrency conflict. Please refresh and try again.");
            }
            if (method != "CASH")
            {
                throw new ServiceException(400, "Only CASH payments can be confirmed at counter.");
            }
            // 3. Chuẩn bị dữ liệu để ghi nhận
            var now = DateTimeOffset.UtcNow;
            var eventId = Guid.NewGuid();
            var actorId = Guid.TryParse(command.ConfirmedBy, out var parsedGuid)
                ? parsedGuid
                : Guid.Parse("00000000-0000-0000-0000-000000000001");
            var payloadJson = JsonSerializer.Serialize(new
            {
                eventId = eventId.ToString(),
                paymentId = paymentId.ToString(),
                bookingId = command.BookingId.ToString(),
                lotId = lotId.ToString(),
                amountMinor = (long)amount,
                currency = currency,
                paidAtUnixSeconds = now.ToUnixTimeSeconds()
            });
            // 4. Cập nhật Status = SUCCESS, ghi Outbox Event và ghi Audit Log
            const string updateSql = """
                UPDATE payments 
                SET status = 'SUCCESS', succeeded_at = @now, collected_by = @actor, version = version + 1 
                WHERE id = @id;
                INSERT INTO integration_outbox(event_id, event_type, aggregate_id, payload) 
                VALUES(@event, 'PaymentSucceeded.v1', @id, @payload::jsonb);
                INSERT INTO audit_logs(id, lot_id, actor_user_id, actor_type, action, entity_type, entity_id, reason, created_at)
                VALUES(gen_random_uuid(), @lot, @actor, 'USER', 'CONFIRM_CASH', 'PAYMENT', @entity, @reason, now());
                """;
            await using (var updateCmd = new NpgsqlCommand(updateSql, conn, tx))
            {
                updateCmd.Parameters.AddWithValue("now", now.UtcDateTime);
                updateCmd.Parameters.AddWithValue("actor", actorId);
                updateCmd.Parameters.AddWithValue("id", paymentId);
                updateCmd.Parameters.AddWithValue("event", eventId);
                updateCmd.Parameters.AddWithValue("payload", payloadJson);
                updateCmd.Parameters.AddWithValue("lot", lotId);
                updateCmd.Parameters.AddWithValue("entity", paymentId.ToString());
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
            if(!await reader.ReadAsync(cancellationToken))
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
    }
}
