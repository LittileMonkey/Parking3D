using Parking.Payment.Infrastructure;
using Parking.ServiceDefaults;
namespace Parking.Payment.Api;
public static class RefundEndpoints
{
 public sealed record CashProof(string Reference);
 public sealed record SignedProof(string ResponseJson);
 public static void MapRefunds(this WebApplication app)
 {
  app.MapGet("/api/v1/payments/bookings/{bookingId:guid}/refundable-payments",async(Guid bookingId,HttpContext ctx,RefundService service,CancellationToken ct)=>Responses.Ok(await service.AvailableAsync(bookingId,ctx.User.Subject(),ct))).RequireAuthorization();
  app.MapGet("/api/v1/payments/bookings/{bookingId:guid}/refunds",async(Guid bookingId,HttpContext ctx,RefundService service,CancellationToken ct)=>Responses.Ok(await service.ListAsync(bookingId,ctx.User.Subject(),ct))).RequireAuthorization();
  app.MapPost("/api/v1/payments/{paymentId:guid}/refunds",async(Guid paymentId,RefundRequest request,HttpContext ctx,RefundService service,CancellationToken ct)=>Responses.Ok(new{id=await service.RequestAsync(paymentId,ctx.User.Subject(),request,ct)})).RequireAuthorization();
  app.MapGet("/api/v1/payments/refunds/lots/{lotId:guid}",async(Guid lotId,HttpContext ctx,RefundService service,CancellationToken ct)=>Responses.Ok(await service.LotQueueAsync(lotId,ctx.User.Subject(),ct))).RequireAuthorization();
  app.MapPost("/api/v1/payments/refunds/lots/{lotId:guid}/{id:guid}/cash-confirmation",async(Guid lotId,Guid id,CashProof request,HttpContext ctx,RefundService service,CancellationToken ct)=>{await service.ConfirmCashAsync(lotId,id,ctx.User.Subject(),request.Reference,ct);return Responses.Ok(new{id,status="SUCCESS"});}).RequireAuthorization();
  app.MapPost("/api/v1/payments/refunds/lots/{lotId:guid}/{id:guid}/reconcile",async(Guid lotId,Guid id,SignedProof request,HttpContext ctx,RefundService service,Npgsql.NpgsqlDataSource db,IConfiguration config,CancellationToken ct)=>{
   await service.RequireRefundLotAsync(lotId,id,ctx.User.Subject(),ct);
   if(string.IsNullOrWhiteSpace(request.ResponseJson)||request.ResponseJson.Length>16000)return Responses.Error(400,"Signed response required");
   try{await RefundWorker.ApplyResponse(db,config,id,request.ResponseJson,ct);return Responses.Ok(new{id,status="SUCCESS"});}
   catch(Exception e)when(e is InvalidOperationException or FormatException or System.Text.Json.JsonException){return Responses.Error(409,"Provider response is not a verified matching successful refund");}
  }).RequireAuthorization();
 }
}
