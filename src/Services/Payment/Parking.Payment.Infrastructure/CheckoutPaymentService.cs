using Google.Protobuf;
using Grpc.Core;
using Microsoft.Extensions.Configuration;
using Npgsql;
using Parking.Contracts.Checkout.V1;
using Parking.Contracts.Identity.V1;
using Parking.Payment.Application.DTOs;
using Parking.Payment.Application.Interfaces;
using Parking.ServiceDefaults;

namespace Parking.Payment.Infrastructure;

// Checkout uses the existing session billing account/ledger, separate from prepaid booking payments.
public sealed class CheckoutPaymentService(NpgsqlDataSource data,
    ParkingCheckoutQuery.ParkingCheckoutQueryClient parking,
    FacilityAuthorization.FacilityAuthorizationClient identity,
    IConfiguration config, IVnPayService vnPay)
{
    private void RequireVnPaySettings()
    {
        if((config["VNPay:HashSecret"]??"").Length<32 || string.IsNullOrWhiteSpace(config["VNPay:TmnCode"]) ||
            !Uri.TryCreate(config["VNPay:BaseUrl"],UriKind.Absolute,out var url)||url.Scheme!="https")
            throw new ServiceException(503,"VNPay checkout is not configured. Use secure provider credentials before enabling it.");
    }
    private async Task Require(Guid actor, Guid lot, string capability, CancellationToken ct)
    {
        try
        {
            var answer=await identity.CheckAccessAsync(new AccessRequest{UserId=actor.ToString(),LotId=lot.ToString(),Capability=capability},
                headers:GrpcHeaders.For(config),deadline:DateTime.UtcNow.AddSeconds(3),cancellationToken:ct);
            if(!answer.Allowed)throw new ServiceException(403,"Assigned active Staff/Manager required.");
        }
        catch(RpcException error){throw DependencyError(error);}
    }

    private async Task<CheckoutBill> Bill(string token, Guid actor, CancellationToken ct)
    {
        try{return await parking.ValidateQuoteAsync(new CheckoutQuoteRequest{QuoteToken=token,ActorId=actor.ToString()},
            headers:GrpcHeaders.For(config),deadline:DateTime.UtcNow.AddSeconds(3),cancellationToken:ct);}
        catch(RpcException error){throw DependencyError(error);}
    }

    private static ServiceException DependencyError(RpcException error)=>new(error.StatusCode switch
        {StatusCode.PermissionDenied=>403,StatusCode.InvalidArgument=>400,StatusCode.NotFound=>404,
         StatusCode.FailedPrecondition or StatusCode.Aborted or StatusCode.AlreadyExists=>409,_=>503},
        "Checkout authorization/quote dependency rejected the request or is unavailable.");

    public async Task<long> CreditAsync(Guid actor,Guid session,Guid lot,CancellationToken ct)
    {
        await Require(actor,lot,"GATE",ct);
        await using var connection=await data.OpenConnectionAsync(ct);
        return await Credit(connection,null,session,lot,ct);
    }

    private static async Task<long> Credit(NpgsqlConnection connection,NpgsqlTransaction? tx,Guid session,Guid lot,CancellationToken ct)
    {
        await using var command=new NpgsqlCommand("""
            SELECT coalesce(sum(p.amount-coalesce((SELECT sum(r.amount) FROM refunds r
                WHERE r.payment_id=p.id AND r.status IN ('SUCCESS','SUCCEEDED')),0)),0)
            FROM payments p JOIN billing_accounts a ON a.id=p.account_id
            WHERE a.session_id=@session AND a.lot_id=@lot AND a.currency='VND'
              AND p.status IN ('SUCCESS','PARTIALLY_REFUNDED')
            """,connection,tx);
        command.Parameters.AddWithValue("session",session);command.Parameters.AddWithValue("lot",lot);
        return checked((long)(decimal)(await command.ExecuteScalarAsync(ct))!);
    }

    private static async Task Lock(NpgsqlConnection connection,NpgsqlTransaction tx,Guid session,CancellationToken ct)
    {
        await using var command=new NpgsqlCommand("SELECT pg_advisory_xact_lock(hashtextextended(@key,0))",connection,tx);
        command.Parameters.AddWithValue("key","checkout-billing:"+session);
        await command.ExecuteNonQueryAsync(ct);
    }

    public async Task<CheckoutSettleReply> SettleAsync(CheckoutSettleRequest request,CancellationToken ct)
    {
        if(!Guid.TryParse(request.ActorId,out var actor) || actor==Guid.Empty ||
           request.Method is not ("NONE" or "CASH" or "VNPAY_QR") || request.CashReceived<0)
            throw new ServiceException(400,"Invalid checkout settlement request.");
        var bill=await Bill(request.QuoteToken,actor,ct);
        var session=Guid.Parse(bill.SessionId);var lot=Guid.Parse(bill.LotId);
        await Require(actor,lot,request.Method=="CASH"?"CASH":"GATE",ct);
        await using var connection=await data.OpenConnectionAsync(ct);
        await using var tx=await connection.BeginTransactionAsync(ct);
        await Lock(connection,tx,session,ct);
        var paid=await Credit(connection,tx,session,lot,ct);
        var remaining=Math.Max(0,bill.GrossAmount-paid);
        Guid? paymentId=null;var method=request.Method;
        if(request.Method=="VNPAY_QR")
        {
            if(!Guid.TryParse(request.PaymentReference,out var reference))throw new ServiceException(409,"Verified Payment ID required.");
            await using var verify=new NpgsqlCommand("""
                SELECT p.id FROM payments p JOIN billing_accounts a ON a.id=p.account_id
                WHERE p.id=@id AND a.session_id=@session AND a.lot_id=@lot AND a.currency='VND'
                  AND p.method='VNPAY' AND p.status='SUCCESS' AND p.succeeded_at IS NOT NULL
                  AND EXISTS(SELECT 1 FROM payment_attempts t WHERE t.payment_id=p.id
                      AND t.status='SUCCESS' AND t.provider='VNPAY' AND t.provider_transaction_id IS NOT NULL)
                FOR UPDATE OF p
                """,connection,tx);
            verify.Parameters.AddWithValue("id",reference);verify.Parameters.AddWithValue("session",session);verify.Parameters.AddWithValue("lot",lot);
            if(await verify.ExecuteScalarAsync(ct) is not Guid found)throw new ServiceException(409,"VNPay payment is not confirmed for this session.");
            paymentId=found;
        }
        if(remaining>0)
        {
            if(request.Method!="CASH")throw new ServiceException(409,"Payment is still required before physical checkout.");
            if(request.CashReceived<remaining || string.IsNullOrWhiteSpace(request.StaffNotes) || request.StaffNotes.Length>2000)
                throw new ServiceException(409,"Sufficient collected cash and Staff notes required.");
            await EnsureNoPending(connection,tx,session,ct);
            var account=await Account(connection,tx,bill,ct);
            paymentId=Guid.NewGuid();
            await using var write=new NpgsqlCommand("""
                INSERT INTO payments(id,account_id,amount,method,status,idempotency_key,collected_by,succeeded_at)
                VALUES(@id,@account,@amount,'CASH','SUCCESS',@key,@actor,now());
                INSERT INTO billing_lines(account_id,line_kind,amount,description,source_key,calculation,created_by)
                VALUES(@account,'CHECKOUT',@amount,'Checkout cash settlement',@key,
                    jsonb_build_object('quoteId',@quote,'paymentId',@id),@actor);
                INSERT INTO audit_logs(lot_id,actor_user_id,actor_type,action,entity_type,entity_id,reason,new_values)
                VALUES(@lot,@actor,'STAFF','CHECKOUT_CASH_COLLECTED','PAYMENT',@entity,@notes,
                    jsonb_build_object('amount',@amount,'sessionId',@session));
                """,connection,tx);
            write.Parameters.AddWithValue("id",paymentId.Value);write.Parameters.AddWithValue("account",account);
            write.Parameters.AddWithValue("amount",remaining);write.Parameters.AddWithValue("key","checkout:"+bill.QuoteId+":cash");
            write.Parameters.AddWithValue("actor",actor);write.Parameters.AddWithValue("quote",bill.QuoteId);
            write.Parameters.AddWithValue("lot",lot);write.Parameters.AddWithValue("entity",paymentId.ToString()!);
            write.Parameters.AddWithValue("notes",request.StaffNotes);write.Parameters.AddWithValue("session",session);
            await write.ExecuteNonQueryAsync(ct);
            await Outbox(connection,tx,paymentId.Value,session,lot,remaining,ct);
            paid+=remaining;
        }
        if(paid<bill.GrossAmount)throw new ServiceException(409,"Insufficient verified settlement.");
        if(paymentId is null && paid>0)
        {
            await using var prior=new NpgsqlCommand("SELECT p.id,p.method::text FROM payments p JOIN billing_accounts a ON a.id=p.account_id WHERE a.session_id=@session AND a.lot_id=@lot AND p.status='SUCCESS' ORDER BY p.succeeded_at DESC LIMIT 1",connection,tx);
            prior.Parameters.AddWithValue("session",session);prior.Parameters.AddWithValue("lot",lot);
            await using var reader=await prior.ExecuteReaderAsync(ct);
            if(await reader.ReadAsync(ct)){paymentId=reader.GetGuid(0);method=reader.GetString(1);}
        }
        await tx.CommitAsync(ct);
        return new(){PaymentId=paymentId?.ToString()??"",SessionId=bill.SessionId,LotId=bill.LotId,
            AmountPaid=paid,Currency="VND",Method=paid==0?"NONE":method};
    }

    private static async Task EnsureNoPending(NpgsqlConnection connection,NpgsqlTransaction tx,Guid session,CancellationToken ct)
    {
        await using var pending=new NpgsqlCommand("SELECT EXISTS(SELECT 1 FROM payments p JOIN billing_accounts a ON a.id=p.account_id WHERE a.session_id=@id AND p.status='PENDING')",connection,tx);
        pending.Parameters.AddWithValue("id",session);
        if((bool)(await pending.ExecuteScalarAsync(ct))!)throw new ServiceException(409,"A checkout payment is pending. Resolve it before collecting another payment.");
    }

    private static async Task<Guid> Account(NpgsqlConnection connection,NpgsqlTransaction tx,CheckoutBill bill,CancellationToken ct)
    {
        await using var command=new NpgsqlCommand("""
            INSERT INTO billing_accounts(lot_id,vehicle_id,session_id,currency) VALUES(@lot,@vehicle,@session,'VND')
            ON CONFLICT(session_id) DO UPDATE SET session_id=EXCLUDED.session_id
            RETURNING id,lot_id,vehicle_id,currency
            """,connection,tx);
        command.Parameters.AddWithValue("lot",Guid.Parse(bill.LotId));command.Parameters.AddWithValue("vehicle",Guid.Parse(bill.VehicleId));
        command.Parameters.AddWithValue("session",Guid.Parse(bill.SessionId));
        await using var reader=await command.ExecuteReaderAsync(ct);await reader.ReadAsync(ct);
        if(reader.GetGuid(1)!=Guid.Parse(bill.LotId)||reader.GetGuid(2)!=Guid.Parse(bill.VehicleId)||reader.GetString(3)!="VND")
            throw new ServiceException(409,"Billing account context mismatch.");
        return reader.GetGuid(0);
    }

    public async Task<CheckoutVnPayView> PrepareVnPayAsync(Guid actor,string quoteToken,string ip,CancellationToken ct)
    {
        RequireVnPaySettings();
        var bill=await Bill(quoteToken,actor,ct);var session=Guid.Parse(bill.SessionId);var lot=Guid.Parse(bill.LotId);
        await Require(actor,lot,"GATE",ct);
        await using var connection=await data.OpenConnectionAsync(ct);await using var tx=await connection.BeginTransactionAsync(ct);
        await Lock(connection,tx,session,ct);
        var key="checkout:"+bill.QuoteId+":vnpay";
        await using(var cached=new NpgsqlCommand("SELECT p.id,p.amount,t.merchant_reference,p.status::text FROM payments p JOIN payment_attempts t ON t.payment_id=p.id WHERE p.idempotency_key=@key",connection,tx))
        {
            cached.Parameters.AddWithValue("key",key);await using var reader=await cached.ExecuteReaderAsync(ct);
            if(await reader.ReadAsync(ct))
            {
                if(reader.GetString(3)!="PENDING")throw new ServiceException(409,"Payment has already completed; refresh checkout quote.");
                return new(reader.GetGuid(0),reader.GetDecimal(1),"PENDING",vnPay.CreatePaymentUrl(reader.GetString(2),checked((long)reader.GetDecimal(1)),"Parking checkout",ip));
            }
        }
        await EnsureNoPending(connection,tx,session,ct);
        var remaining=Math.Max(0,bill.GrossAmount-await Credit(connection,tx,session,lot,ct));
        if(remaining==0)throw new ServiceException(409,"No additional payment required.");
        var account=await Account(connection,tx,bill,ct);var payment=Guid.NewGuid();var txn="CO"+Guid.NewGuid().ToString("N");
        var url=vnPay.CreatePaymentUrl(txn,remaining,"Parking checkout",ip);
        await using var insert=new NpgsqlCommand("""
            INSERT INTO payments(id,account_id,amount,method,status,idempotency_key) VALUES(@id,@account,@amount,'VNPAY','PENDING',@key);
            INSERT INTO payment_attempts(payment_id,provider,merchant_reference,status,requested_at)
            VALUES(@id,'VNPAY',@txn,'PENDING',now());
            INSERT INTO billing_lines(account_id,line_kind,amount,description,source_key,calculation,created_by)
            VALUES(@account,'CHECKOUT',@amount,'Checkout VNPay charge',@key,jsonb_build_object('quoteId',@quote,'paymentId',@id),@actor);
            """,connection,tx);
        insert.Parameters.AddWithValue("id",payment);insert.Parameters.AddWithValue("account",account);insert.Parameters.AddWithValue("amount",remaining);
        insert.Parameters.AddWithValue("key",key);insert.Parameters.AddWithValue("txn",txn);insert.Parameters.AddWithValue("quote",bill.QuoteId);
        insert.Parameters.AddWithValue("actor",actor);await insert.ExecuteNonQueryAsync(ct);await tx.CommitAsync(ct);
        return new(payment,remaining,"PENDING",url);
    }

    public async Task<VnPayIpnResult> HandleIpnAsync(IDictionary<string,string> query,CancellationToken ct)
    {
        RequireVnPaySettings();
        string Get(string name)=>query.TryGetValue(name,out var value)?value:"";
        if(!vnPay.ValidateSignature(query,Get("vnp_SecureHash")))return new("97","Invalid signature");
        if(Get("vnp_TmnCode")!=config["VNPay:TmnCode"])return new("97","Merchant mismatch");
        if(!long.TryParse(Get("vnp_Amount"),out var raw)||raw<=0||raw%100!=0)return new("04","Invalid amount");
        await using var connection=await data.OpenConnectionAsync(ct);await using var tx=await connection.BeginTransactionAsync(ct);
        Guid payment;Guid session;Guid lot;long amount;string state;
        await using(var lookup=new NpgsqlCommand("""
            SELECT p.id,a.session_id,a.lot_id,p.amount,p.status::text FROM payments p
            JOIN payment_attempts t ON t.payment_id=p.id JOIN billing_accounts a ON a.id=p.account_id
            WHERE t.merchant_reference=@ref AND t.provider='VNPAY' AND a.session_id IS NOT NULL
            FOR UPDATE OF p,t
            """,connection,tx))
        {
            lookup.Parameters.AddWithValue("ref",Get("vnp_TxnRef"));await using var reader=await lookup.ExecuteReaderAsync(ct);
            if(!await reader.ReadAsync(ct))return new("01","Order not found");
            payment=reader.GetGuid(0);session=reader.GetGuid(1);lot=reader.GetGuid(2);amount=checked((long)reader.GetDecimal(3));state=reader.GetString(4);
        }
        if(raw/100!=amount)return new("04","Invalid amount");
        if(state!="PENDING")return new("02","Order already confirmed");
        var success=Get("vnp_ResponseCode")=="00"&&Get("vnp_TransactionStatus")=="00";
        if(success&&string.IsNullOrWhiteSpace(Get("vnp_TransactionNo")))return new("01","Missing provider transaction");
        await using(var update=new NpgsqlCommand("""
            UPDATE payments SET status=@status::payment_status,succeeded_at=CASE WHEN @success THEN now() ELSE NULL END,version=version+1 WHERE id=@id;
            UPDATE payment_attempts SET status=@status,completed_at=now(),response_code=@code,
                provider_transaction_id=nullif(@provider,'') WHERE payment_id=@id;
            INSERT INTO audit_logs(lot_id,actor_type,action,entity_type,entity_id,new_values)
            VALUES(@lot,'PROVIDER','CHECKOUT_VNPAY_IPN','PAYMENT',@entity,jsonb_build_object('status',@status,'amount',@amount));
            """,connection,tx))
        {
            update.Parameters.AddWithValue("status",success?"SUCCESS":"FAILED");update.Parameters.AddWithValue("success",success);
            update.Parameters.AddWithValue("id",payment);update.Parameters.AddWithValue("code",Get("vnp_ResponseCode"));
            update.Parameters.AddWithValue("provider",Get("vnp_TransactionNo"));update.Parameters.AddWithValue("lot",lot);
            update.Parameters.AddWithValue("entity",payment.ToString());update.Parameters.AddWithValue("amount",amount);
            await update.ExecuteNonQueryAsync(ct);
        }
        if(success)await Outbox(connection,tx,payment,session,lot,amount,ct);
        await tx.CommitAsync(ct);return new("00","Confirm success");
    }

    private static async Task Outbox(NpgsqlConnection connection,NpgsqlTransaction tx,Guid payment,Guid session,Guid lot,long amount,CancellationToken ct)
    {
        var id=Guid.NewGuid();var message=new CheckoutPaymentSucceeded {EventId=id.ToString(),PaymentId=payment.ToString(),
            SessionId=session.ToString(),LotId=lot.ToString(),Amount=amount,Currency="VND"};
        await using var command=new NpgsqlCommand("INSERT INTO integration_outbox(event_id,event_type,aggregate_id,payload) VALUES(@id,'CheckoutPaymentSucceeded.v1',@payment,@payload::jsonb)",connection,tx);
        command.Parameters.AddWithValue("id",id);command.Parameters.AddWithValue("payment",payment);
        command.Parameters.AddWithValue("payload",JsonFormatter.Default.Format(message));await command.ExecuteNonQueryAsync(ct);
    }
}

public sealed record CheckoutVnPayView(Guid PaymentId,decimal Amount,string Status,string PaymentUrl);
public sealed record CheckoutVnPayRequest(string QuoteToken);

public sealed class CheckoutSettlementGrpc(CheckoutPaymentService service) : CheckoutSettlement.CheckoutSettlementBase
{
    public override async Task<CheckoutCreditReply> GetCredit(CheckoutCreditRequest request,ServerCallContext context)
    {
        try
        {
            if(!Guid.TryParse(request.ActorId,out var actor)||!Guid.TryParse(request.SessionId,out var session)||!Guid.TryParse(request.LotId,out var lot))
                throw new ServiceException(400,"Valid identifiers required.");
            return new(){Amount=await service.CreditAsync(actor,session,lot,context.CancellationToken)};
        }
        catch(ServiceException error){throw Map(error);}
    }
    public override async Task<CheckoutSettleReply> Settle(CheckoutSettleRequest request,ServerCallContext context)
    {try{return await service.SettleAsync(request,context.CancellationToken);}catch(ServiceException error){throw Map(error);}}
    private static RpcException Map(ServiceException error)=>new(new Status(error.StatusCode switch
        {400=>StatusCode.InvalidArgument,403=>StatusCode.PermissionDenied,409=>StatusCode.FailedPrecondition,_=>StatusCode.Unavailable},error.Message));
}
