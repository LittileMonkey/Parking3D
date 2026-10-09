using System.Security.Cryptography;
using System.Text;
using Google.Protobuf;
using Microsoft.Extensions.Configuration;
using Npgsql;
using Parking.Contracts.Identity.V1;
using Parking.Contracts.Payments.V1;
using Parking.Payment.Application;
using Parking.ServiceDefaults;

namespace Parking.Payment.Infrastructure;

public sealed class PaymentService(NpgsqlDataSource db,BookingPaymentQuery.BookingPaymentQueryClient parking,
    FacilityAuthorization.FacilityAuthorizationClient identity,IConfiguration config) : IPaymentService
{
    public async Task<PaymentView> CreateAsync(Guid user,CreatePaymentRequest request,string key,CancellationToken ct)
    {
        if(request.BookingId==Guid.Empty||string.IsNullOrWhiteSpace(key)||key.Length>128)throw new ServiceException(400,"Booking ID and Idempotency-Key required");
        if(request.Method!="CASH")throw new ServiceException(503,"VNPay adapter/signature configuration is not implemented; no fake payment is issued");
        var active=await identity.CheckAccessAsync(new AccessRequest{UserId=user.ToString(),LotId=Guid.Empty.ToString(),Capability="USER"},headers:GrpcHeaders.For(config),deadline:DateTime.UtcNow.AddSeconds(3),cancellationToken:ct);
        if(!active.Allowed)throw new ServiceException(403,"Current account unavailable");
        var scopedKey=Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(user+":"+key)));
        // A retry must still work after the event has already confirmed the booking.
        await using(var cached=db.CreateCommand("SELECT p.id,a.lot_id,a.booking_id,p.amount,a.currency,p.method::text,p.status::text,p.version FROM payments p JOIN billing_accounts a ON a.id=p.account_id WHERE p.idempotency_key=@key"))
        {
            cached.Parameters.AddWithValue("key",scopedKey);await using var r=await cached.ExecuteReaderAsync(ct);
            if(await r.ReadAsync(ct)){var v=Read(r);if(v.BookingId!=request.BookingId||v.Method!=request.Method)throw new ServiceException(409,"Idempotency key reused");return v;}
        }
        var quote=await parking.GetQuoteAsync(new BookingQuoteRequest{BookingId=request.BookingId.ToString(),UserId=user.ToString()},
            headers:GrpcHeaders.For(config),deadline:DateTime.UtcNow.AddSeconds(5),cancellationToken:ct);
        var lot=Guid.Parse(quote.LotId);var id=Guid.NewGuid();var account=Guid.NewGuid();
        await using var conn=await db.OpenConnectionAsync(ct);await using var tx=await conn.BeginTransactionAsync(ct);
        await using(var guard=new NpgsqlCommand("SELECT pg_advisory_xact_lock(hashtextextended(@booking,0))",conn,tx))
        {guard.Parameters.AddWithValue("booking","billing:"+request.BookingId);await guard.ExecuteNonQueryAsync(ct);}
        await using(var old=new NpgsqlCommand("SELECT p.id,a.lot_id,a.booking_id,p.amount,a.currency,p.method::text,p.status::text,p.version FROM payments p JOIN billing_accounts a ON a.id=p.account_id WHERE p.idempotency_key=@key",conn,tx))
        {
            old.Parameters.AddWithValue("key",scopedKey);await using var r=await old.ExecuteReaderAsync(ct);
            if(await r.ReadAsync(ct))
            {var view=Read(r);if(view.BookingId!=request.BookingId||view.Amount!=quote.AmountMinor||view.Method!=request.Method)throw new ServiceException(409,"Idempotency key reused");return view;}
        }
        await using(var existing=new NpgsqlCommand("SELECT id FROM billing_accounts WHERE booking_id=@id",conn,tx))
        {existing.Parameters.AddWithValue("id",request.BookingId);var old=await existing.ExecuteScalarAsync(ct);if(old is Guid previous)account=previous;}
        await using(var write=new NpgsqlCommand("""
            INSERT INTO billing_accounts(id,lot_id,vehicle_id,booking_id,currency,created_at)
            VALUES(@account,@lot,@vehicle,@booking,@currency,now()) ON CONFLICT(booking_id) DO NOTHING;
            INSERT INTO payments(id,account_id,amount,method,status,idempotency_key,created_at)
            VALUES(@id,@account,@amount,'CASH','PENDING',@key,now());
            INSERT INTO audit_logs(id,lot_id,actor_user_id,actor_type,action,entity_type,entity_id,created_at)
            VALUES(gen_random_uuid(),@lot,@user,'USER','CREATE_PAYMENT','PAYMENT',@entity,now());
            """,conn,tx))
        {
            write.Parameters.AddWithValue("account",account);write.Parameters.AddWithValue("lot",lot);write.Parameters.AddWithValue("vehicle",Guid.Parse(quote.VehicleId));
            write.Parameters.AddWithValue("booking",request.BookingId);write.Parameters.AddWithValue("currency",quote.Currency);write.Parameters.AddWithValue("id",id);
            write.Parameters.AddWithValue("amount",quote.AmountMinor);write.Parameters.AddWithValue("key",scopedKey);write.Parameters.AddWithValue("user",user);write.Parameters.AddWithValue("entity",id.ToString());
            await write.ExecuteNonQueryAsync(ct);
        }
        await tx.CommitAsync(ct);return new PaymentView(id,lot,request.BookingId,quote.AmountMinor,quote.Currency,"CASH","PENDING",1);
    }

    public async Task<PaymentView> ConfirmCashAsync(Guid actor,Guid lot,Guid payment,CashConfirmationRequest request,CancellationToken ct)
    {
        if(request.Version<1 || string.IsNullOrWhiteSpace(request.Reason)||request.Reason.Length>500)throw new ServiceException(400,"Version and confirmation reason required");
        var permission=await identity.CheckAccessAsync(new AccessRequest{UserId=actor.ToString(),LotId=lot.ToString(),Capability="CASH"},
            headers:GrpcHeaders.For(config),deadline:DateTime.UtcNow.AddSeconds(3),cancellationToken:ct);
        if(!permission.Allowed)throw new ServiceException(403,"Assigned active Staff required");
        await using var conn=await db.OpenConnectionAsync(ct);await using var tx=await conn.BeginTransactionAsync(ct);
        PaymentView view;
        await using(var query=new NpgsqlCommand("SELECT p.id,a.lot_id,a.booking_id,p.amount,a.currency,p.method::text,p.status::text,p.version FROM payments p JOIN billing_accounts a ON a.id=p.account_id WHERE p.id=@id AND a.lot_id=@lot FOR UPDATE OF p",conn,tx))
        {query.Parameters.AddWithValue("id",payment);query.Parameters.AddWithValue("lot",lot);await using var r=await query.ExecuteReaderAsync(ct);if(!await r.ReadAsync(ct))throw new ServiceException(404,"Payment not found");view=Read(r);}
        // Repeated confirmation is a read of an already committed result, never another receipt/event.
        if(view.Status=="SUCCESS")return view;
        if(view.Method!="CASH"||view.Status!="PENDING"||view.Version!=request.Version)throw new ServiceException(409,"Payment state/version conflict");
        var eventId=Guid.NewGuid();var now=DateTimeOffset.UtcNow;
        var message=new PaymentSucceeded{EventId=eventId.ToString(),PaymentId=payment.ToString(),BookingId=view.BookingId.ToString(),LotId=lot.ToString(),AmountMinor=view.Amount,Currency=view.Currency,PaidAtUnixSeconds=now.ToUnixTimeSeconds()};
        await using(var update=new NpgsqlCommand("""
            UPDATE payments SET status='SUCCESS',succeeded_at=@now,collected_by=@actor,version=version+1 WHERE id=@id;
            INSERT INTO integration_outbox(event_id,event_type,aggregate_id,payload) VALUES(@event,'PaymentSucceeded.v1',@id,@payload::jsonb);
            INSERT INTO audit_logs(id,lot_id,actor_user_id,actor_type,action,entity_type,entity_id,reason,created_at)
            VALUES(gen_random_uuid(),@lot,@actor,'USER','CONFIRM_CASH','PAYMENT',@entity,@reason,now());
            """,conn,tx))
        {
            update.Parameters.AddWithValue("now",now.UtcDateTime);update.Parameters.AddWithValue("actor",actor);update.Parameters.AddWithValue("id",payment);update.Parameters.AddWithValue("event",eventId);
            update.Parameters.AddWithValue("payload",JsonFormatter.Default.Format(message));update.Parameters.AddWithValue("lot",lot);update.Parameters.AddWithValue("entity",payment.ToString());update.Parameters.AddWithValue("reason",request.Reason.Trim());
            await update.ExecuteNonQueryAsync(ct);
        }
        await tx.CommitAsync(ct);return view with{Status="SUCCESS",Version=view.Version+1};
    }
    private static PaymentView Read(NpgsqlDataReader r)=>new(r.GetGuid(0),r.GetGuid(1),r.GetGuid(2),checked((long)r.GetDecimal(3)),r.GetString(4),r.GetString(5),r.GetString(6),r.GetInt32(7));
}
