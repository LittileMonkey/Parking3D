using System.Security.Cryptography;
using System.Text;
using Google.Protobuf;
using Microsoft.Extensions.Configuration;
using Npgsql;
using Parking.Contracts.Identity.V1;
using Parking.Contracts.Payments.V1;
using Parking.Payment.Application.DTOs;
using Parking.Payment.Application.Interfaces;
using Parking.ServiceDefaults;

namespace Parking.Payment.Infrastructure.Services;

/// <summary>
/// Dịch vụ điều phối thanh toán trung tâm, tích hợp cơ sở dữ liệu PostgreSQL, gRPC và cổng VNPay.
/// </summary>
public sealed class PaymentService(
    NpgsqlDataSource db, 
    BookingPaymentQuery.BookingPaymentQueryClient parking,
    FacilityAuthorization.FacilityAuthorizationClient identity, 
    IConfiguration config,
    IVnPayService vnPayService) : IPaymentService
{
    /// <summary>
    /// Khởi tạo lượt thanh toán (CASH hoặc VNPAY), sinh mã giao dịch duy nhất và URL thanh toán bảo mật.
    /// </summary>
    public async Task<PaymentView> CreateAsync(Guid user, CreatePaymentRequest request, string key, CancellationToken ct, string? ipAddress = null)
    {
        if (request.BookingId == Guid.Empty || string.IsNullOrWhiteSpace(key) || key.Length > 128)
            throw new ServiceException(400, "Booking ID and Idempotency-Key required");


        // 1. Chỉ chấp nhận phương thức CASH hoặc VNPAY
        if (request.Method != "CASH" && request.Method != "VNPAY")
            throw new ServiceException(400, "Unsupported payment method. Only CASH and VNPAY are supported.");

        //// 2. Xác thực quyền tài khoản qua gRPC Identity
        //var active = await identity.CheckAccessAsync(
        //    new AccessRequest { 
        //            UserId = user.ToString(), 
        //            LotId = Guid.Empty.ToString(), 
        //            Capability = "USER" }, 
        //    headers: GrpcHeaders.For(config), 
        //    deadline: DateTime.UtcNow.AddSeconds(3), 
        //    cancellationToken: ct
        //);

        //if (!active.Allowed) 
        //    throw new ServiceException(403, "Current account unavailable");

        var scopedKey = Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(user + ":" + key)));


        // 3. Kiểm tra Idempotency trước để tránh lock oan
        
        await using (var cached = db.CreateCommand("""
            SELECT p.id, a.lot_id, a.booking_id, p.amount, a.currency, 
                    p.method::text, p.status::text, p.version 
            FROM payments p 
            JOIN billing_accounts a ON a.id = p.account_id
            WHERE p.idempotency_key = @key
        """))
        {
            cached.Parameters.AddWithValue("key", scopedKey); 
            await using var r = await cached.ExecuteReaderAsync(ct);
            if (await r.ReadAsync(ct)) 
            { 
                var v = Read(r); 
                if (v.BookingId != request.BookingId || v.Method != request.Method) 
                    throw new ServiceException(409, "Idempotency key reused"); 
                return v; 
            }
        }

        // 4. Lấy báo giá đơn đặt chỗ từ Parking gRPC
        var quote = await parking.GetQuoteAsync(new BookingQuoteRequest { BookingId = request.BookingId.ToString(), UserId = user.ToString() },
            headers: GrpcHeaders.For(config), deadline: DateTime.UtcNow.AddSeconds(5), cancellationToken: ct);

        var lot = Guid.Parse(quote.LotId); 
        var id = Guid.NewGuid(); 
        var account = Guid.NewGuid();
        var attemptId = Guid.NewGuid();
        var txnRef = attemptId.ToString("N");

        await using var conn = await db.OpenConnectionAsync(ct); 
        await using var tx = await conn.BeginTransactionAsync(ct);

        // 5. Khóa giao dịch theo BookingId để tránh thanh toán đồng thời (Concurrency lock)
        await using (var guard = new NpgsqlCommand("SELECT pg_advisory_xact_lock(hashtextextended(@booking,0))", conn, tx))
        { guard.Parameters.AddWithValue("booking", "billing:" + request.BookingId); await guard.ExecuteNonQueryAsync(ct); }
        await using (var old = new NpgsqlCommand("SELECT " +
                                                    "p.id," +
                                                    "a.lot_id," +
                                                    "a.booking_id," +
                                                    "p.amount," +
                                                    "a.currency," +
                                                    "p.method::text," +
                                                    "p.status::text," +
                                                    "p.version " +
                                                    "FROM payments p " +
                                                    "JOIN billing_accounts a " +
                                                    "ON a.id=p.account_id " +
                                                    "WHERE p.idempotency_key=@key", conn, tx)
                    )
        {
            old.Parameters.AddWithValue("key", scopedKey); await using var r = await old.ExecuteReaderAsync(ct);
            if (await r.ReadAsync(ct))
            { 
                var view = Read(r); 
                if (view.BookingId != request.BookingId || view.Amount != quote.AmountMinor || view.Method != request.Method) 
                    throw new ServiceException(409, "Idempotency key reused"); return view; }

        }

        // 6. Ghi dữ liệu thanh toán vào Database
        await using (var existing = new NpgsqlCommand("SELECT id FROM billing_accounts WHERE booking_id=@id", conn, tx))
        { existing.Parameters.AddWithValue("id", request.BookingId); var old = await existing.ExecuteScalarAsync(ct); if (old is Guid previous) account = previous; }
        await using (var write = new NpgsqlCommand("""
            INSERT INTO billing_accounts(id,lot_id,vehicle_id,booking_id,currency,created_at)
            VALUES(@account,@lot,@vehicle,@booking,@currency,now()) ON CONFLICT(booking_id) DO NOTHING;
            INSERT INTO payments(id,account_id,amount,method,status,idempotency_key,created_at)
            VALUES(@id,@account,@amount,@method::public.payment_method,'PENDING',@key,now());
            INSERT INTO audit_logs(id,lot_id,actor_user_id,actor_type,action,entity_type,entity_id,created_at)
            VALUES(gen_random_uuid(),@lot,@user,'USER','CREATE_PAYMENT','PAYMENT',@entity,now());
            """, conn, tx))
        {
            write.Parameters.AddWithValue("account", account); 
            write.Parameters.AddWithValue("lot", lot); 
            write.Parameters.AddWithValue("vehicle", Guid.Parse(quote.VehicleId));
            write.Parameters.AddWithValue("booking", request.BookingId); 
            write.Parameters.AddWithValue("currency", quote.Currency); 
            write.Parameters.AddWithValue("id", id);
            write.Parameters.AddWithValue("amount", quote.AmountMinor);
            write.Parameters.AddWithValue("method", request.Method);
            write.Parameters.AddWithValue("key", scopedKey); 
            write.Parameters.AddWithValue("user", user); 
            write.Parameters.AddWithValue("entity", id.ToString());
            await write.ExecuteNonQueryAsync(ct);
        }

        // 7. Nếu là VNPAY: Ghi nhận attempt và sinh đường link thanh toán có chữ ký HMAC-SHA512
        string? paymentUrl = null;
        if (request.Method == "VNPAY")
        {
            await using (var attemptCmd = new NpgsqlCommand("""
                INSERT INTO payment_attempts(id,payment_id,provider,merchant_reference,status,requested_at)
                VALUES(@attemptId,@paymentId,'VNPAY',@txnRef,'INITIATED',now());
                """, conn, tx))
            {
                attemptCmd.Parameters.AddWithValue("attemptId", attemptId);
                attemptCmd.Parameters.AddWithValue("paymentId", id);
                attemptCmd.Parameters.AddWithValue("txnRef", txnRef);
                await attemptCmd.ExecuteNonQueryAsync(ct);
            }
            paymentUrl = vnPayService.CreatePaymentUrl(
                txnRef,
                quote.AmountMinor,
                $"Thanh toan giu cho {request.BookingId}",
                ipAddress ?? "127.0.0.1");
        }
        await tx.CommitAsync(ct);
        return new PaymentView(id, lot, request.BookingId, quote.AmountMinor, quote.Currency, request.Method, "PENDING", 1, paymentUrl);
    }





    /// <summary>
    /// Nhân viên bãi xe xác nhận đã thu tiền mặt, cập nhật trạng thái thanh toán và lưu sự kiện Outbox.
    /// </summary>
    public async Task<PaymentView> ConfirmCashAsync(Guid actor, Guid lot, Guid payment, CashConfirmationRequest request, CancellationToken ct)
    {
        if (request.Version < 1 || string.IsNullOrWhiteSpace(request.Reason) || request.Reason.Length > 500) 
            throw new ServiceException(400, "Version and confirmation reason required");

        var permission = await identity.CheckAccessAsync(new AccessRequest { UserId = actor.ToString(), LotId = lot.ToString(), Capability = "CASH" },
            headers: GrpcHeaders.For(config), deadline: DateTime.UtcNow.AddSeconds(3), cancellationToken: ct);

        if (!permission.Allowed) 
            throw new ServiceException(403, "Assigned active Staff required");

        await using var conn = await db.OpenConnectionAsync(ct); 
        await using var tx = await conn.BeginTransactionAsync(ct);

        PaymentView view;
        await using (var query = new NpgsqlCommand("SELECT " +
            "p.id,a.lot_id," +
            "a.booking_id," +
            "p.amount," +
            "a.currency," +
            "p.method::text," +
            "p.status::text," +
            "p.version " +
            "FROM payments p " +
            "JOIN billing_accounts a " +
            "ON a.id=p.account_id " +
            "WHERE p.id=@id AND a.lot_id=@lot FOR UPDATE OF p", conn, tx))
        { query.Parameters.AddWithValue("id", payment); query.Parameters.AddWithValue("lot", lot); 

        await using var r = await query.ExecuteReaderAsync(ct); 

        if (!await r.ReadAsync(ct)) 
                throw new ServiceException(404, "Payment not found"); view = Read(r); }

        // Repeated confirmation is a read of an already committed result, never another receipt/event.
        if (view.Status == "SUCCESS") 
            return view;

        if (view.Method != "CASH" || view.Status != "PENDING" || view.Version != request.Version) 
            throw new ServiceException(409, "Payment state/version conflict");

        var eventId = Guid.NewGuid(); var now = DateTimeOffset.UtcNow;
        var message = new PaymentSucceeded { EventId = eventId.ToString(), PaymentId = payment.ToString(), BookingId = view.BookingId.ToString(), LotId = lot.ToString(), AmountMinor = view.Amount, Currency = view.Currency, PaidAtUnixSeconds = now.ToUnixTimeSeconds() };

        await using (var update = new NpgsqlCommand("""
            UPDATE payments SET status='SUCCESS',succeeded_at=@now,collected_by=@actor,version=version+1 WHERE id=@id;
            INSERT INTO integration_outbox(event_id,event_type,aggregate_id,payload) VALUES(@event,'PaymentSucceeded.v1',@id,@payload::jsonb);
            INSERT INTO audit_logs(id,lot_id,actor_user_id,actor_type,action,entity_type,entity_id,reason,created_at)
            VALUES(gen_random_uuid(),@lot,@actor,'USER','CONFIRM_CASH','PAYMENT',@entity,@reason,now());
            """, conn, tx))
        {
            update.Parameters.AddWithValue("now", now.UtcDateTime); 
            update.Parameters.AddWithValue("actor", actor); 
            update.Parameters.AddWithValue("id", payment); 
            update.Parameters.AddWithValue("event", eventId);
            update.Parameters.AddWithValue("payload", JsonFormatter.Default.Format(message)); 
            update.Parameters.AddWithValue("lot", lot); 
            update.Parameters.AddWithValue("entity", payment.ToString()); 
            update.Parameters.AddWithValue("reason", request.Reason.Trim());
            await update.ExecuteNonQueryAsync(ct);
        }
        await tx.CommitAsync(ct); 
        return view with { Status = "SUCCESS", Version = view.Version + 1 };

    }

    public async Task<VnPayIpnResult> HandleVnPayIpnAsync(
        IDictionary<string, string> queryParams, CancellationToken ct)
    {
        // ════════════════════════════════════════════════════
        // LỚP 1: Xác thực chữ ký HMAC-SHA512
        // VNPay ký toàn bộ params bằng HashSecret, ta kiểm tra lại
        // ════════════════════════════════════════════════════
        var inputHash = Get(queryParams, "vnp_SecureHash");
        if (!vnPayService.ValidateSignature(queryParams, inputHash))
            return new VnPayIpnResult("97", "Invalid Signature");

        // ════════════════════════════════════════════════════
        // LỚP 2: Tra cứu attempt và payment từ merchant_reference (txnRef)
        // txnRef = attemptId.ToString("N") lúc tạo payment
        // ════════════════════════════════════════════════════
        var txnRef = Get(queryParams, "vnp_TxnRef");
        if (string.IsNullOrWhiteSpace(txnRef))
            return new VnPayIpnResult("01", "Order Not Found");

        Guid attemptId, paymentId;
        long dbAmount;
        string attemptStatus;

        await using (var lookupCmd = db.CreateCommand(
            "SELECT a.id, a.payment_id, a.status, p.amount " +
            "FROM payment_attempts a " +
            "JOIN payments p ON p.id = a.payment_id " +
            "WHERE a.merchant_reference = @txnRef AND a.provider = 'VNPAY'"))
        {
            lookupCmd.Parameters.AddWithValue("txnRef", txnRef);
            await using var r = await lookupCmd.ExecuteReaderAsync(ct);
            if (!await r.ReadAsync(ct))
                return new VnPayIpnResult("01", "Order Not Found");

            attemptId    = r.GetGuid(0);
            paymentId    = r.GetGuid(1);
            attemptStatus = r.GetString(2);
            dbAmount     = checked((long)r.GetDecimal(3));
        }

        // ════════════════════════════════════════════════════
        // LỚP 3: Kiểm tra số tiền
        // VNPay gửi amountMinor * 100 (ví dụ 50000 VND => gửi 5000000)
        // ════════════════════════════════════════════════════
        if (!long.TryParse(Get(queryParams, "vnp_Amount", "0"), out var rawAmount))
            return new VnPayIpnResult("04", "Invalid Amount");

        var vnpAmount = rawAmount / 100; // Quy đổi về đơn vị tiền thực
        if (vnpAmount != dbAmount)
            return new VnPayIpnResult("04", "Invalid Amount");

        // ════════════════════════════════════════════════════
        // LỚP 4: Idempotency Guard
        // Nếu đã xử lý rồi (SUCCESS/FAILED) => không ghi lại, trả về ngay
        // ════════════════════════════════════════════════════
        if (attemptStatus == "SUCCESS")
            return new VnPayIpnResult("02", "Order Already Confirmed");

        if (attemptStatus == "FAILED")
            return new VnPayIpnResult("00", "Confirm Success"); // VNPay yêu cầu luôn trả "00"

        // ════════════════════════════════════════════════════
        // LỚP 5: Xử lý kết quả thực tế từ VNPay
        // vnp_ResponseCode = "00" => thành công; khác => thất bại
        // ════════════════════════════════════════════════════
        var responseCode = Get(queryParams, "vnp_ResponseCode");
        var vnpTxnNo     = Get(queryParams, "vnp_TransactionNo");

        await using var conn = await db.OpenConnectionAsync(ct);
        await using var tx   = await conn.BeginTransactionAsync(ct);

        if (responseCode == "00")
        {
            // ── Thành công: cập nhật attempt + payment + ghi outbox event ──
            var eventId = Guid.NewGuid();
            var now     = DateTimeOffset.UtcNow;

            // Lấy thông tin bổ sung để tạo event
            Guid lotId; Guid bookingId; string currency;
            await using (var infoCmd = new NpgsqlCommand(
                "SELECT a.lot_id, a.booking_id, a.currency " +
                "FROM billing_accounts a " +
                "JOIN payments p ON p.account_id = a.id " +
                "WHERE p.id = @paymentId", conn, tx))
            {
                infoCmd.Parameters.AddWithValue("paymentId", paymentId);
                await using var ri = await infoCmd.ExecuteReaderAsync(ct);
                await ri.ReadAsync(ct);
                lotId     = ri.GetGuid(0);
                bookingId = ri.GetGuid(1);
                currency  = ri.GetString(2);
            }

            var message = new PaymentSucceeded
            {
                EventId             = eventId.ToString(),
                PaymentId           = paymentId.ToString(),
                BookingId           = bookingId.ToString(),
                LotId               = lotId.ToString(),
                AmountMinor         = dbAmount,
                Currency            = currency,
                PaidAtUnixSeconds   = now.ToUnixTimeSeconds()
            };

            await using (var updateCmd = new NpgsqlCommand("""
                UPDATE payment_attempts
                   SET status = 'SUCCESS', provider_transaction_id = @vnpTxnNo, completed_at = @now
                 WHERE id = @attemptId;

                UPDATE payments
                   SET status = 'SUCCESS', succeeded_at = @now, version = version + 1
                 WHERE id = @paymentId;

                INSERT INTO integration_outbox(event_id, event_type, aggregate_id, payload)
                VALUES(@event, 'PaymentSucceeded.v1', @paymentId, @payload::jsonb);

                INSERT INTO audit_logs(id, lot_id, actor_user_id, actor_type, action, entity_type, entity_id, created_at)
                VALUES(gen_random_uuid(), @lotId, '00000000-0000-0000-0000-000000000000',
                       'SYSTEM', 'VNPAY_IPN_SUCCESS', 'PAYMENT', @entity, @now);
                """, conn, tx))
            {
                updateCmd.Parameters.AddWithValue("attemptId",  attemptId);
                updateCmd.Parameters.AddWithValue("paymentId",  paymentId);
                updateCmd.Parameters.AddWithValue("vnpTxnNo",   vnpTxnNo);
                updateCmd.Parameters.AddWithValue("now",        now.UtcDateTime);
                updateCmd.Parameters.AddWithValue("event",      eventId);
                updateCmd.Parameters.AddWithValue("payload",    Google.Protobuf.JsonFormatter.Default.Format(message));
                updateCmd.Parameters.AddWithValue("lotId",      lotId);
                updateCmd.Parameters.AddWithValue("entity",     paymentId.ToString());
                await updateCmd.ExecuteNonQueryAsync(ct);
            }

            await tx.CommitAsync(ct);
            return new VnPayIpnResult("00", "Confirm Success");
        }
        else
        {
            // ── Thất bại: đánh dấu attempt FAILED, không thay đổi payment (vẫn PENDING để retry) ──
            await using (var failCmd = new NpgsqlCommand("""
                UPDATE payment_attempts
                   SET status = 'FAILED', response_code = @responseCode, responded_at = @now
                 WHERE id = @attemptId;
                """, conn, tx))
            {
                failCmd.Parameters.AddWithValue("attemptId",    attemptId);
                failCmd.Parameters.AddWithValue("responseCode", responseCode);
                failCmd.Parameters.AddWithValue("now",          DateTime.UtcNow);
                await failCmd.ExecuteNonQueryAsync(ct);
            }

            await tx.CommitAsync(ct);
            // VNPay spec: luôn trả "00" để VNPay không retry vô hạn
            return new VnPayIpnResult("00", "Confirm Success");
        }
    }

    /// <summary>
    /// Xử lý ReturnUrl từ VNPay — trình duyệt của khách hàng bị redirect đến đây sau thanh toán.
    /// Chỉ XÁC THỰC chữ ký và ĐỌC kết quả, KHÔNG ghi vào database (IPN server-to-server đã làm trước rồi).
    /// </summary>
    public Task<VnPayReturnResult> HandleVnPayReturnAsync(
        IDictionary<string, string> queryParams, CancellationToken ct)
    {
        // Bước 1: Xác thực chữ ký — bảo vệ tránh URL bị làm giả
        var inputHash = Get(queryParams, "vnp_SecureHash");
        if (!vnPayService.ValidateSignature(queryParams, inputHash))
        {
            return Task.FromResult(new VnPayReturnResult(
                IsSuccess:     false,
                Message:       "Chữ ký không hợp lệ. Giao dịch có thể đã bị can thiệp.",
                TxnRef:        Get(queryParams, "vnp_TxnRef"),
                Amount:        0,
                BankCode:      "",
                TransactionNo: "",
                ResponseCode:  "97"));
        }

        // Bước 2: Đọc các thông tin quan trọng từ query string
        var responseCode  = Get(queryParams, "vnp_ResponseCode");
        var txnRef        = Get(queryParams, "vnp_TxnRef");
        var bankCode      = Get(queryParams, "vnp_BankCode");
        var transactionNo = Get(queryParams, "vnp_TransactionNo");

        // Bước 3: Quy đổi số tiền (VNPay gửi x100)
        long.TryParse(Get(queryParams, "vnp_Amount", "0"), out var rawAmount);
        var amount = rawAmount / 100;

        // Bước 4: Trả kết quả cho frontend (isSuccess chỉ đúng khi responseCode = "00")
        var isSuccess = responseCode == "00";
        var message   = isSuccess
            ? "Thanh toán VNPay thành công! Chỗ đậu xe của bạn đã được xác nhận."
            : $"Thanh toán thất bại (mã lỗi VNPay: {responseCode}). Vui lòng thử lại.";

        return Task.FromResult(new VnPayReturnResult(
            IsSuccess:     isSuccess,
            Message:       message,
            TxnRef:        txnRef,
            Amount:        amount,
            BankCode:      bankCode,
            TransactionNo: transactionNo,
            ResponseCode:  responseCode));
    }

    /// <summary>
    /// Chuyển đổi dữ liệu đọc từ NpgsqlDataReader sang đối tượng PaymentView.
    /// </summary>
    private static PaymentView Read(NpgsqlDataReader r) 
        => new(r.GetGuid(0), r.GetGuid(1), r.GetGuid(2), checked((long)r.GetDecimal(3)), r.GetString(4), r.GetString(5), r.GetString(6), r.GetInt32(7));

    /// <summary>
    /// Helper đọc giá trị từ IDictionary an toàn (TryGetValue thay cho GetValueOrDefault).
    /// </summary>
    private static string Get(IDictionary<string, string> d, string key, string fallback = "")
        => d.TryGetValue(key, out var v) ? v : fallback;
}
