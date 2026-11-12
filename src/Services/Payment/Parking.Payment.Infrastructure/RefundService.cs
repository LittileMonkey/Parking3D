using System.Text.Json;
using Npgsql;
using Parking.Contracts.Payments.V1;
using Parking.Contracts.Identity.V1;
using Parking.ServiceDefaults;
using Microsoft.Extensions.Configuration;
namespace Parking.Payment.Infrastructure;

public sealed record RefundRequest(long Amount,string Reason,string IdempotencyKey);
public sealed class RefundService(NpgsqlDataSource db,BookingPaymentQuery.BookingPaymentQueryClient parking,
 FacilityAuthorization.FacilityAuthorizationClient identity,IConfiguration config)
{
 public async Task<JsonElement> AvailableAsync(Guid booking,Guid actor,CancellationToken ct)
 {
  var policy=await parking.GetRefundEligibilityAsync(new BookingQuoteRequest{BookingId=booking.ToString(),UserId=actor.ToString()},headers:GrpcHeaders.For(config),deadline:DateTime.UtcNow.AddSeconds(5),cancellationToken:ct);
  await using var cmd=db.CreateCommand("""
   SELECT jsonb_build_object('eligible',@eligible,'payments',coalesce((SELECT jsonb_agg(row_to_json(x)) FROM (
    SELECT p.id,p.amount,p.method::text,p.status::text,greatest(0,p.amount-coalesce((SELECT sum(r.amount) FROM refunds r WHERE r.payment_id=p.id AND r.status<>'FAILED'),0)) AS "remaining"
    FROM payments p JOIN billing_accounts a ON a.id=p.account_id WHERE a.booking_id=@booking AND p.status IN ('SUCCESS','PARTIALLY_REFUNDED','REFUNDED') ORDER BY p.created_at
   )x),'[]'::jsonb))::text
   """);cmd.Parameters.AddWithValue("booking",booking);cmd.Parameters.AddWithValue("eligible",policy.Eligible);return JsonSerializer.Deserialize<JsonElement>((string)(await cmd.ExecuteScalarAsync(ct))!);
 }
 public async Task<JsonElement> ListAsync(Guid booking,Guid actor,CancellationToken ct)
 {
  await parking.GetRefundEligibilityAsync(new BookingQuoteRequest{BookingId=booking.ToString(),UserId=actor.ToString()},headers:GrpcHeaders.For(config),deadline:DateTime.UtcNow.AddSeconds(5),cancellationToken:ct);
  await using var cmd=db.CreateCommand("""
   SELECT coalesce(jsonb_agg(row_to_json(x)),'[]'::jsonb)::text FROM (
    SELECT r.id,r.payment_id AS "paymentId",r.amount,r.status,r.reason,r.provider_reference AS "providerReference",r.created_at AS "createdAt",r.succeeded_at AS "succeededAt"
    FROM refunds r JOIN payments p ON p.id=r.payment_id JOIN billing_accounts a ON a.id=p.account_id
    WHERE a.booking_id=@booking ORDER BY r.created_at DESC
   )x
   """);cmd.Parameters.AddWithValue("booking",booking);return JsonSerializer.Deserialize<JsonElement>((string)(await cmd.ExecuteScalarAsync(ct))!);
 }
 public async Task<Guid> RequestAsync(Guid payment,Guid actor,RefundRequest request,CancellationToken ct)
 {
  if(request.Amount<=0||string.IsNullOrWhiteSpace(request.Reason)||request.Reason.Length>1000||string.IsNullOrWhiteSpace(request.IdempotencyKey)||request.IdempotencyKey.Length>100)throw new ServiceException(400,"Positive amount, reason and idempotency key required");
  Guid booking;
  await using(var find=db.CreateCommand("SELECT a.booking_id FROM payments p JOIN billing_accounts a ON a.id=p.account_id WHERE p.id=@id"))
  {find.Parameters.AddWithValue("id",payment);booking=await find.ExecuteScalarAsync(ct) is Guid id?id:throw new ServiceException(404,"Booking payment not found");}
  var policy=await parking.GetRefundEligibilityAsync(new BookingQuoteRequest{BookingId=booking.ToString(),UserId=actor.ToString()},headers:GrpcHeaders.For(config),deadline:DateTime.UtcNow.AddSeconds(5),cancellationToken:ct);
  if(!policy.Eligible)throw new ServiceException(409,"Booking is not eligible for a cancellation refund");
  await using var conn=await db.OpenConnectionAsync(ct);await using var tx=await conn.BeginTransactionAsync(ct);
  var key=actor+":"+request.IdempotencyKey;
  await using(var claim=new NpgsqlCommand("SELECT pg_advisory_xact_lock(hashtextextended(@key,0))",conn,tx)) {claim.Parameters.AddWithValue("key",key);await claim.ExecuteNonQueryAsync(ct);}
  await using(var old=new NpgsqlCommand("SELECT id,payment_id,amount,reason FROM refunds WHERE idempotency_key=@key",conn,tx))
  {old.Parameters.AddWithValue("key",key);await using var r=await old.ExecuteReaderAsync(ct);if(await r.ReadAsync(ct)){if(r.GetGuid(1)!=payment||r.GetDecimal(2)!=request.Amount||r.GetString(3)!=request.Reason.Trim())throw new ServiceException(409,"Idempotency key used with another refund");return r.GetGuid(0);}}
  long amount;string method,state;Guid lot;
  await using(var read=new NpgsqlCommand("SELECT p.amount,p.method::text,p.status::text,a.lot_id FROM payments p JOIN billing_accounts a ON a.id=p.account_id WHERE p.id=@id FOR UPDATE OF p",conn,tx))
  {read.Parameters.AddWithValue("id",payment);await using var r=await read.ExecuteReaderAsync(ct);if(!await r.ReadAsync(ct))throw new ServiceException(404,"Payment missing");amount=checked((long)r.GetDecimal(0));method=r.GetString(1);state=r.GetString(2);lot=r.GetGuid(3);}
  if(state is not ("SUCCESS" or "PARTIALLY_REFUNDED"))throw new ServiceException(409,"Only successful unrefunded payments may be refunded");
  if(method is not ("CASH" or "VNPAY"))throw new ServiceException(409,"Refund provider is not supported for this payment method");
  await using(var total=new NpgsqlCommand("SELECT coalesce(sum(amount),0) FROM refunds WHERE payment_id=@id AND status<>'FAILED'",conn,tx))
  {total.Parameters.AddWithValue("id",payment);var reserved=Convert.ToDecimal(await total.ExecuteScalarAsync(ct));if(reserved+request.Amount>amount)throw new ServiceException(409,"Amount exceeds remaining refundable balance, including pending requests");}
  var refund=Guid.NewGuid();
  await using(var write=new NpgsqlCommand("""
   INSERT INTO refunds(id,payment_id,amount,status,idempotency_key,reason,requested_by)
    VALUES(@id,@payment,@amount,@status,@key,@reason,@actor);
   INSERT INTO audit_logs(lot_id,actor_user_id,actor_type,action,entity_type,entity_id,reason,new_values)
    VALUES(@lot,@actor,'USER','REQUEST_REFUND','REFUND',@entity,@reason,jsonb_build_object('amount',@amount));
   """,conn,tx))
  {write.Parameters.AddWithValue("id",refund);write.Parameters.AddWithValue("payment",payment);write.Parameters.AddWithValue("amount",request.Amount);write.Parameters.AddWithValue("status",method=="CASH"?"AWAITING_CASH":"PENDING_PROVIDER");write.Parameters.AddWithValue("key",key);write.Parameters.AddWithValue("reason",request.Reason.Trim());write.Parameters.AddWithValue("actor",actor);write.Parameters.AddWithValue("lot",lot);write.Parameters.AddWithValue("entity",refund.ToString());await write.ExecuteNonQueryAsync(ct);}
  await tx.CommitAsync(ct);return refund;
 }
 public async Task<JsonElement> LotQueueAsync(Guid lot,Guid actor,CancellationToken ct)
 {
  await Manager(lot,actor,ct);await using var cmd=db.CreateCommand("""
   SELECT coalesce(jsonb_agg(row_to_json(x)),'[]'::jsonb)::text FROM (
    SELECT r.id,r.payment_id AS "paymentId",a.booking_id AS "bookingId",r.amount,r.status,r.reason,r.last_error AS "lastError",p.method::text
    FROM refunds r JOIN payments p ON p.id=r.payment_id JOIN billing_accounts a ON a.id=p.account_id
    WHERE a.lot_id=@lot ORDER BY (r.status='SUCCESS'),r.created_at LIMIT 200
   )x
   """);cmd.Parameters.AddWithValue("lot",lot);return JsonSerializer.Deserialize<JsonElement>((string)(await cmd.ExecuteScalarAsync(ct))!);
 }
 public async Task RequireRefundLotAsync(Guid lot,Guid refund,Guid actor,CancellationToken ct)
 {
  await Manager(lot,actor,ct);await using var cmd=db.CreateCommand("SELECT EXISTS(SELECT 1 FROM refunds r JOIN payments p ON p.id=r.payment_id JOIN billing_accounts a ON a.id=p.account_id WHERE r.id=@id AND a.lot_id=@lot)");cmd.Parameters.AddWithValue("id",refund);cmd.Parameters.AddWithValue("lot",lot);if(!(bool)(await cmd.ExecuteScalarAsync(ct))!)throw new ServiceException(404,"Refund not found in lot");
 }
 private async Task Manager(Guid lot,Guid actor,CancellationToken ct)
 {var reply=await identity.CheckAccessAsync(new AccessRequest{UserId=actor.ToString(),LotId=lot.ToString(),Capability="MANAGER"},headers:GrpcHeaders.For(config),deadline:DateTime.UtcNow.AddSeconds(5),cancellationToken:ct);if(!reply.Allowed)throw new ServiceException(403,"Assigned manager required");}
 public async Task ConfirmCashAsync(Guid lot,Guid id,Guid actor,string reference,CancellationToken ct)
 {
  if(string.IsNullOrWhiteSpace(reference)||reference.Length>200)throw new ServiceException(400,"Actual cash refund receipt reference required");await Manager(lot,actor,ct);
  await using var conn=await db.OpenConnectionAsync(ct);await using var tx=await conn.BeginTransactionAsync(ct);Guid payment;
  await using(var find=new NpgsqlCommand("SELECT r.payment_id FROM refunds r JOIN payments p ON p.id=r.payment_id JOIN billing_accounts a ON a.id=p.account_id WHERE r.id=@id AND a.lot_id=@lot AND p.method='CASH'",conn,tx))
  {find.Parameters.AddWithValue("id",id);find.Parameters.AddWithValue("lot",lot);payment=await find.ExecuteScalarAsync(ct) is Guid p?p:throw new ServiceException(404,"Cash refund not found");}
  await using(var claim=new NpgsqlCommand("SELECT id FROM payments WHERE id=@id FOR UPDATE",conn,tx)){claim.Parameters.AddWithValue("id",payment);await claim.ExecuteScalarAsync(ct);}
  await using(var change=new NpgsqlCommand("UPDATE refunds SET status='SUCCESS',provider_reference=@reference,approved_by=@actor,succeeded_at=now(),updated_at=now() WHERE id=@id AND status='AWAITING_CASH'",conn,tx))
  {change.Parameters.AddWithValue("id",id);change.Parameters.AddWithValue("actor",actor);change.Parameters.AddWithValue("reference","CASH:"+reference.Trim());if(await change.ExecuteNonQueryAsync(ct)==0)throw new ServiceException(409,"Refund is no longer awaiting cash confirmation");}
  await CompleteLedger(conn,tx,payment,id,actor,ct);await tx.CommitAsync(ct);
 }
 public static async Task CompleteLedger(NpgsqlConnection conn,NpgsqlTransaction tx,Guid payment,Guid refund,Guid? actor,CancellationToken ct)
 {
  await using var cmd=new NpgsqlCommand("""
   UPDATE payments p SET status=CASE WHEN (SELECT coalesce(sum(amount),0) FROM refunds WHERE payment_id=p.id AND status='SUCCESS')>=p.amount THEN 'REFUNDED'::payment_status ELSE 'PARTIALLY_REFUNDED'::payment_status END,version=version+1 WHERE p.id=@payment;
   INSERT INTO integration_outbox(event_id,event_type,aggregate_id,payload)
    SELECT gen_random_uuid(),'RefundSucceeded.v1',r.id,jsonb_build_object('refundId',r.id::text,'bookingId',a.booking_id::text,'amountMinor',r.amount::text)
    FROM refunds r JOIN payments p ON p.id=r.payment_id JOIN billing_accounts a ON a.id=p.account_id WHERE r.id=@refund AND a.booking_id IS NOT NULL;
   INSERT INTO audit_logs(lot_id,actor_user_id,actor_type,action,entity_type,entity_id,reason)
    SELECT a.lot_id,@actor,'SERVICE','REFUND_SUCCEEDED','REFUND',@entity,'Verified refund completion' FROM billing_accounts a JOIN payments p ON p.account_id=a.id WHERE p.id=@payment;
   """,conn,tx);cmd.Parameters.AddWithValue("payment",payment);cmd.Parameters.AddWithValue("refund",refund);cmd.Parameters.AddWithValue("entity",refund.ToString());cmd.Parameters.Add("actor",NpgsqlTypes.NpgsqlDbType.Uuid).Value=(object?)actor??DBNull.Value;await cmd.ExecuteNonQueryAsync(ct);
 }
}
