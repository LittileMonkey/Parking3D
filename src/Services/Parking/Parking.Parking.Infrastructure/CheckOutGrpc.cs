using System.Security.Cryptography;
using Google.Protobuf;
using Grpc.Core;
using Microsoft.Extensions.Configuration;
using Npgsql;
using Parking.Contracts.Checkout.V1;
using Parking.Parking.Application;
using Parking.Parking.Application.DTOs;
using Parking.Parking.Application.Interfaces;
using Parking.ServiceDefaults;

namespace Parking.Parking.Infrastructure;

public sealed class CheckOutPayments(CheckoutSettlement.CheckoutSettlementClient client,
    IConfiguration config) : ICheckOutPayments
{
    public async Task<decimal> GetCreditAsync(Guid actorId, Guid sessionId, Guid lotId, CancellationToken ct)
    {
        var reply = await client.GetCreditAsync(new CheckoutCreditRequest { ActorId=actorId.ToString(),
            SessionId=sessionId.ToString(),LotId=lotId.ToString() },headers:GrpcHeaders.For(config),
            deadline:DateTime.UtcNow.AddSeconds(3),cancellationToken:ct);
        return reply.Amount;
    }

    public async Task<CheckOutPaymentEvidence> SettleAsync(CheckOutProof proof,
        ConfirmCheckOutRequestDto request, CancellationToken ct)
    {
        if (request.CashReceived != decimal.Truncate(request.CashReceived))
            throw new ServiceException(400,"VND cash must be a whole number.");
        var reply = await client.SettleAsync(new CheckoutSettleRequest { ActorId=proof.ActorId.ToString(),
            QuoteToken=request.QuoteToken,Method=request.PaymentMethod,CashReceived=checked((long)request.CashReceived),
            PaymentReference=request.PaymentReference??"",StaffNotes=request.StaffNotes??"" },
            headers:GrpcHeaders.For(config),deadline:DateTime.UtcNow.AddSeconds(5),cancellationToken:ct);
        return new(Guid.TryParse(reply.PaymentId,out var id)?id:null,Guid.Parse(reply.SessionId),
            Guid.Parse(reply.LotId),reply.AmountPaid,reply.Currency,reply.Method);
    }
}

public sealed class ParkingCheckoutQueryGrpc(ICheckOutTokens tokens, IParkingRepository repository,
    IFacilityAccess access, NpgsqlDataSource data) : ParkingCheckoutQuery.ParkingCheckoutQueryBase
{
    public override async Task<CheckoutBill> ValidateQuote(CheckoutQuoteRequest request, ServerCallContext context)
    {
        try
        {
            var proof=tokens.ValidateQuote(request.QuoteToken);
            if (!Guid.TryParse(request.ActorId,out var actor) || actor!=proof.ActorId)
                throw new ServiceException(403,"Quote actor mismatch.");
            var lot=await repository.GetSessionLotIdAsync(proof.SessionId,context.CancellationToken);
            if(lot!=proof.LotId) throw new ServiceException(409,"Quote session mismatch.");
            await access.RequireAsync(actor,proof.LotId,"GATE",context.CancellationToken);
            await using var active=data.CreateCommand("SELECT EXISTS(SELECT 1 FROM parking_sessions WHERE id=@id AND lot_id=@lot AND vehicle_id=@vehicle AND status='ACTIVE')");
            active.Parameters.AddWithValue("id",proof.SessionId);active.Parameters.AddWithValue("lot",proof.LotId);
            active.Parameters.AddWithValue("vehicle",proof.VehicleId);
            if(!(bool)(await active.ExecuteScalarAsync(context.CancellationToken))!) throw new ServiceException(409,"Session no longer active.");
            var current=await repository.GetCheckOutQuoteAsync(proof.LotId,proof.GateId,proof.Plate,null,
                context.CancellationToken,proof.SessionId);
            if(!current.IsPlateMatched||current.OvertimeAmount!=proof.GrossAmount||current.SlotId!=proof.SlotId)
                throw new ServiceException(409,"Checkout fee changed. Request a new quote; prior payments remain credited.");
            return new CheckoutBill { QuoteId=proof.QuoteId.ToString(),SessionId=proof.SessionId.ToString(),
                LotId=proof.LotId.ToString(),VehicleId=proof.VehicleId.ToString(),GrossAmount=checked((long)proof.GrossAmount),
                Currency="VND",ExpiresAtUnix=proof.ExpiresAt.ToUnixTimeSeconds() };
        }
        catch(ServiceException error)
        { throw new RpcException(new Status(error.StatusCode==403?StatusCode.PermissionDenied:error.StatusCode==503?StatusCode.Unavailable:StatusCode.FailedPrecondition,error.Message)); }
    }
}

public sealed class ParkingCheckoutEventsGrpc(NpgsqlDataSource data) : ParkingCheckoutEvents.ParkingCheckoutEventsBase
{
    public override async Task<CheckoutDeliveryReply> Deliver(CheckoutPaymentSucceeded request, ServerCallContext context)
    {
        if(!Guid.TryParse(request.EventId,out var id)||!Guid.TryParse(request.SessionId,out var session)||
           !Guid.TryParse(request.LotId,out var lot)||!Guid.TryParse(request.PaymentId,out _)||request.Amount<=0||request.Currency!="VND")
            throw new RpcException(new Status(StatusCode.InvalidArgument,"Invalid checkout payment event."));
        var hash=Convert.ToHexStringLower(SHA256.HashData(request.ToByteArray()));
        await using var connection=await data.OpenConnectionAsync(context.CancellationToken);
        await using var tx=await connection.BeginTransactionAsync(context.CancellationToken);
        await using(var guard=new NpgsqlCommand("SELECT pg_advisory_xact_lock(hashtextextended(@key,0))",connection,tx))
        {guard.Parameters.AddWithValue("key","checkout-event:"+id);await guard.ExecuteNonQueryAsync(context.CancellationToken);}
        await using(var old=new NpgsqlCommand("SELECT payload_hash FROM integration_inbox WHERE event_id=@id",connection,tx))
        {
            old.Parameters.AddWithValue("id",id);
            if(await old.ExecuteScalarAsync(context.CancellationToken) is string prior)
            {
                if(prior!=hash)throw new RpcException(new Status(StatusCode.AlreadyExists,"Event ID reused."));
                return new(){Outcome="RECORDED"};
            }
        }
        await using var write=new NpgsqlCommand("""
            INSERT INTO integration_inbox(event_id,event_type,payload_hash,outcome) VALUES(@id,'CheckoutPaymentSucceeded.v1',@hash,'RECORDED');
            INSERT INTO audit_logs(lot_id,actor_type,action,entity_type,entity_id,request_id,new_values)
            VALUES(@lot,'SERVICE','CHECKOUT_PAYMENT_RECEIVED','PARKING_SESSION',@session,@request,@payload::jsonb);
            """,connection,tx);
        write.Parameters.AddWithValue("id",id);write.Parameters.AddWithValue("hash",hash);write.Parameters.AddWithValue("lot",lot);
        write.Parameters.AddWithValue("session",session.ToString());write.Parameters.AddWithValue("request",id.ToString());
        write.Parameters.AddWithValue("payload",JsonFormatter.Default.Format(request));
        await write.ExecuteNonQueryAsync(context.CancellationToken);await tx.CommitAsync(context.CancellationToken);
        return new(){Outcome="RECORDED"};
    }
}
