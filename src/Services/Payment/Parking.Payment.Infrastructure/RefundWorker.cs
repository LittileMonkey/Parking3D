using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Npgsql;
namespace Parking.Payment.Infrastructure;

public sealed class RefundWorker(NpgsqlDataSource db,IConfiguration config,IHttpClientFactory clients,ILogger<RefundWorker> log):BackgroundService
{
 protected override async Task ExecuteAsync(CancellationToken ct)
 {
  using var timer=new PeriodicTimer(TimeSpan.FromSeconds(10));
  try{while(await timer.WaitForNextTickAsync(ct)){try{await Tick(ct);}catch(OperationCanceledException)when(ct.IsCancellationRequested){break;}catch(Exception e){log.LogWarning("Refund worker deferred: {Type}",e.GetType().Name);}}}catch(OperationCanceledException)when(ct.IsCancellationRequested){}
 }
 private async Task Tick(CancellationToken ct)
 {
  await using(var recover=db.CreateCommand("UPDATE refunds SET status='RECONCILIATION_REQUIRED',last_error='Uncertain delivery; do not resend',updated_at=now() WHERE status='IN_FLIGHT' AND updated_at<now()-interval '5 minutes'"))await recover.ExecuteNonQueryAsync(ct);
  if(!bool.TryParse(config["VNPay:RefundsEnabled"],out var enabled)||!enabled)return;
  var secret=config["VNPay:HashSecret"];var merchant=config["VNPay:TmnCode"];var ip=config["VNPay:RefundIpAddress"];
  if(string.IsNullOrWhiteSpace(secret)||string.IsNullOrWhiteSpace(merchant)||!System.Net.IPAddress.TryParse(ip,out _))return;
  var endpoint=new Uri(config["VNPay:ApiUrl"]??"https://sandbox.vnpayment.vn/merchant_webapi/api/transaction");if(endpoint.Scheme!="https")throw new InvalidOperationException("VNPay requires HTTPS");
  Guid id;Dictionary<string,object> payload;
  await using(var conn=await db.OpenConnectionAsync(ct))
  await using(var tx=await conn.BeginTransactionAsync(ct))
  {
   Guid actor;string txnRef,txnNo,date;long amount,original;
   await using(var read=new NpgsqlCommand("""
    SELECT r.id,r.requested_by,r.amount,p.amount,coalesce(a.merchant_reference,''),coalesce(a.provider_transaction_id,''),coalesce(a.provider_created_date,'')
    FROM refunds r JOIN payments p ON p.id=r.payment_id
    LEFT JOIN LATERAL(SELECT * FROM payment_attempts WHERE payment_id=p.id AND status='SUCCESS' ORDER BY completed_at DESC LIMIT 1)a ON true
    WHERE r.status='PENDING_PROVIDER' AND p.method='VNPAY' ORDER BY r.created_at LIMIT 1 FOR UPDATE OF r SKIP LOCKED
    """,conn,tx))
   {await using var r=await read.ExecuteReaderAsync(ct);if(!await r.ReadAsync(ct))return;id=r.GetGuid(0);actor=r.GetGuid(1);amount=checked((long)r.GetDecimal(2));original=checked((long)r.GetDecimal(3));txnRef=r.GetString(4);txnNo=r.GetString(5);date=r.GetString(6);}
   if(txnRef.Length==0||date.Length!=14||txnNo.Length==0){await using var invalid=new NpgsqlCommand("UPDATE refunds SET status='RECONCILIATION_REQUIRED',last_error='Original provider transaction metadata unavailable',updated_at=now() WHERE id=@id",conn,tx);invalid.Parameters.AddWithValue("id",id);await invalid.ExecuteNonQueryAsync(ct);await tx.CommitAsync(ct);return;}
   payload=new(){["vnp_RequestId"]=id.ToString("N"),["vnp_Version"]="2.1.0",["vnp_Command"]="refund",["vnp_TmnCode"]=merchant,["vnp_TransactionType"]=amount==original?"02":"03",["vnp_TxnRef"]=txnRef,["vnp_Amount"]=checked(amount*100),["vnp_TransactionNo"]=txnNo,["vnp_TransactionDate"]=date,["vnp_CreateBy"]=actor.ToString(),["vnp_CreateDate"]=DateTimeOffset.UtcNow.ToOffset(TimeSpan.FromHours(7)).ToString("yyyyMMddHHmmss"),["vnp_IpAddr"]=ip!,["vnp_OrderInfo"]="Refund "+id.ToString("N")};
   var fields=new[]{"vnp_RequestId","vnp_Version","vnp_Command","vnp_TmnCode","vnp_TransactionType","vnp_TxnRef","vnp_Amount","vnp_TransactionNo","vnp_TransactionDate","vnp_CreateBy","vnp_CreateDate","vnp_IpAddr","vnp_OrderInfo"};
   payload["vnp_SecureHash"]=Sign(secret,string.Join("|",fields.Select(x=>Convert.ToString(payload[x],System.Globalization.CultureInfo.InvariantCulture))));
   await using var claim=new NpgsqlCommand("UPDATE refunds SET status='IN_FLIGHT',provider_payload=@payload::jsonb,updated_at=now() WHERE id=@id",conn,tx);claim.Parameters.AddWithValue("id",id);claim.Parameters.AddWithValue("payload",JsonSerializer.Serialize(payload));await claim.ExecuteNonQueryAsync(ct);await tx.CommitAsync(ct);
  }
  // No automatic re-send after dispatch: a timeout may mean the provider accepted money movement.
  try{using var response=await clients.CreateClient("refund-provider").PostAsJsonAsync(endpoint,payload,ct);response.EnsureSuccessStatusCode();var json=await response.Content.ReadAsStringAsync(ct);await ApplyResponse(db,config,id,json,ct);}
  catch(Exception e)when(e is HttpRequestException or TaskCanceledException or JsonException or InvalidOperationException or FormatException)
  {await using var uncertain=db.CreateCommand("UPDATE refunds SET status='RECONCILIATION_REQUIRED',last_error='Provider response uncertain; reconcile signed result',updated_at=now() WHERE id=@id AND status='IN_FLIGHT'");uncertain.Parameters.AddWithValue("id",id);await uncertain.ExecuteNonQueryAsync(CancellationToken.None);}
 }
 private static string Sign(string key,string data)=>Convert.ToHexString(HMACSHA512.HashData(Encoding.UTF8.GetBytes(key),Encoding.UTF8.GetBytes(data))).ToLowerInvariant();
 public static async Task ApplyResponse(NpgsqlDataSource db,IConfiguration config,Guid id,string json,CancellationToken ct)
 {
  using var doc=JsonDocument.Parse(json);var root=doc.RootElement;string Get(string key)=>root.TryGetProperty(key,out var value)?value.ToString():"";
  var fields=new[]{"vnp_ResponseId","vnp_Command","vnp_ResponseCode","vnp_Message","vnp_TmnCode","vnp_TxnRef","vnp_Amount","vnp_BankCode","vnp_PayDate","vnp_TransactionNo","vnp_TransactionType","vnp_TransactionStatus","vnp_OrderInfo"};
  var expected=Sign(config["VNPay:HashSecret"]??throw new InvalidOperationException("Missing provider secret"),string.Join("|",fields.Select(Get)));
  if(Get("vnp_SecureHash").Length!=128||!CryptographicOperations.FixedTimeEquals(Convert.FromHexString(expected),Convert.FromHexString(Get("vnp_SecureHash"))))throw new InvalidOperationException("Invalid refund response signature");
  await using var conn=await db.OpenConnectionAsync(ct);await using var tx=await conn.BeginTransactionAsync(ct);Guid payment;string original;
  await using(var locate=new NpgsqlCommand("SELECT payment_id FROM refunds WHERE id=@id",conn,tx)){locate.Parameters.AddWithValue("id",id);payment=await locate.ExecuteScalarAsync(ct) is Guid p?p:throw new InvalidOperationException("Refund missing");}
  await using(var claim=new NpgsqlCommand("SELECT id FROM payments WHERE id=@id FOR UPDATE",conn,tx)){claim.Parameters.AddWithValue("id",payment);await claim.ExecuteScalarAsync(ct);}
  await using(var read=new NpgsqlCommand("SELECT provider_payload::text,status FROM refunds WHERE id=@id FOR UPDATE",conn,tx))
  {read.Parameters.AddWithValue("id",id);await using var r=await read.ExecuteReaderAsync(ct);await r.ReadAsync(ct);if(r.GetString(1)=="SUCCESS")return;if(r.IsDBNull(0))throw new InvalidOperationException("No dispatched refund request");original=r.GetString(0);}
  using var sent=JsonDocument.Parse(original);foreach(var key in new[]{"vnp_TmnCode","vnp_TxnRef","vnp_Amount","vnp_TransactionType","vnp_OrderInfo"})if(Get(key)!=sent.RootElement.GetProperty(key).ToString())throw new InvalidOperationException("Response does not match refund");
  if(Get("vnp_Command")!="refund"||Get("vnp_ResponseCode")!="00"||Get("vnp_TransactionStatus")!="00"||string.IsNullOrWhiteSpace(Get("vnp_TransactionNo")))throw new InvalidOperationException("Refund not confirmed successful by provider");
  await using(var write=new NpgsqlCommand("UPDATE refunds SET status='SUCCESS',provider_reference=@reference,succeeded_at=now(),updated_at=now(),last_error=NULL WHERE id=@id",conn,tx)){write.Parameters.AddWithValue("id",id);write.Parameters.AddWithValue("reference","VNPAY:"+Get("vnp_TransactionNo"));await write.ExecuteNonQueryAsync(ct);}
  await RefundService.CompleteLedger(conn,tx,payment,id,null,ct);await tx.CommitAsync(ct);
 }
}
