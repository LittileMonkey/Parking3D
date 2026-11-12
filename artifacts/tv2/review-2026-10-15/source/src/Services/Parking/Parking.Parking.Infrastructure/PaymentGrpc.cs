using System.Security.Cryptography;
using Google.Protobuf;
using Grpc.Core;
using Npgsql;
using Parking.Contracts.Payments.V1;
using Parking.Parking.Application;
using Parking.Parking.Domain;

namespace Parking.Parking.Infrastructure;

public sealed class BookingPaymentQueryGrpc(NpgsqlDataSource db,IFacilityAccess access) : BookingPaymentQuery.BookingPaymentQueryBase
{
    public override async Task<BookingQuoteReply> GetQuote(BookingQuoteRequest request,ServerCallContext context)
    {
        if(!Guid.TryParse(request.BookingId,out var booking)||!Guid.TryParse(request.UserId,out var user))
            throw new RpcException(new Status(StatusCode.InvalidArgument,"Valid IDs required"));
        await using var command=db.CreateCommand("SELECT b.id,b.lot_id,b.vehicle_id,b.customer_id,b.estimated_amount,s.currency,b.status::text,b.hold_expires_at FROM bookings b JOIN pricing_snapshots s ON s.id=b.pricing_snapshot_id WHERE b.id=@id");
        command.Parameters.AddWithValue("id",booking);
        Guid lot;Guid vehicle;Guid? owner;long amount;string currency;string state;DateTime? expiry;
        await using(var r=await command.ExecuteReaderAsync(context.CancellationToken))
        {
            if(!await r.ReadAsync(context.CancellationToken))throw new RpcException(new Status(StatusCode.NotFound,"Booking not found"));
            lot=r.GetGuid(1);vehicle=r.GetGuid(2);owner=r.IsDBNull(3)?null:r.GetGuid(3);amount=checked((long)r.GetDecimal(4));currency=r.GetString(5);state=r.GetString(6);expiry=r.IsDBNull(7)?null:r.GetDateTime(7);
        }
        if(owner!=user)
        {
            try{await access.RequireAsync(user,lot,"CASH",context.CancellationToken);}
            catch(global::Parking.ServiceDefaults.ServiceException){throw new RpcException(new Status(StatusCode.PermissionDenied,"Booking owner or assigned Staff required"));}
        }
        if(state!="PENDING_PAYMENT" || expiry<=DateTime.UtcNow)throw new RpcException(new Status(StatusCode.FailedPrecondition,"Booking no longer payable"));
        return new BookingQuoteReply{BookingId=booking.ToString(),LotId=lot.ToString(),VehicleId=vehicle.ToString(),AmountMinor=amount,Currency=currency,Status=state};
    }
}

public sealed class PaymentEventsGrpc(NpgsqlDataSource db) : ParkingPaymentEvents.ParkingPaymentEventsBase
{
    public override async Task<DeliveryReply> DeliverPaymentSucceeded(PaymentSucceeded request,ServerCallContext context)
    {
        if(!Guid.TryParse(request.EventId,out var eventId)||!Guid.TryParse(request.PaymentId,out var paymentId)
            ||!Guid.TryParse(request.BookingId,out var booking)||!Guid.TryParse(request.LotId,out var lot)
            ||request.AmountMinor<=0 || request.Currency!="VND")
            throw new RpcException(new Status(StatusCode.InvalidArgument,"Invalid payment event"));
        DateTime paid;
        try{paid=DateTimeOffset.FromUnixTimeSeconds(request.PaidAtUnixSeconds).UtcDateTime;}
        catch(ArgumentOutOfRangeException){throw new RpcException(new Status(StatusCode.InvalidArgument,"Invalid payment timestamp"));}
        if(paid>DateTime.UtcNow.AddSeconds(15))throw new RpcException(new Status(StatusCode.InvalidArgument,"Future payment"));
        var hash=Convert.ToHexStringLower(SHA256.HashData(request.ToByteArray()));var ct=context.CancellationToken;
        await using var conn=await db.OpenConnectionAsync(ct);await using var tx=await conn.BeginTransactionAsync(ct);
        await using(var lockEvent=new NpgsqlCommand("SELECT pg_advisory_xact_lock(hashtextextended(@key,0))",conn,tx))
        {lockEvent.Parameters.AddWithValue("key","event:"+eventId);await lockEvent.ExecuteNonQueryAsync(ct);}
        await using(var prior=new NpgsqlCommand("SELECT payload_hash,outcome FROM integration_inbox WHERE event_id=@event",conn,tx))
        {
            prior.Parameters.AddWithValue("event",eventId);await using var r=await prior.ExecuteReaderAsync(ct);
            if(await r.ReadAsync(ct))
            {if(r.GetString(0)!=hash)throw new RpcException(new Status(StatusCode.AlreadyExists,"Event ID reused with different payload"));return new DeliveryReply{Outcome=r.GetString(1)};}
        }
        Guid vehicle; Guid? slot; string state;DateTime? expiry;long quote;
        await using(var query=new NpgsqlCommand("""
            SELECT b.vehicle_id,b.status::text,b.hold_expires_at,b.estimated_amount,
              (SELECT slot_id FROM slot_reservations WHERE booking_id=b.id AND status IN ('HELD','CONFIRMED') LIMIT 1)
            FROM bookings b WHERE b.id=@id AND b.lot_id=@lot
            """,conn,tx))
        {
            query.Parameters.AddWithValue("id",booking);query.Parameters.AddWithValue("lot",lot);await using var r=await query.ExecuteReaderAsync(ct);
            if(!await r.ReadAsync(ct))throw new RpcException(new Status(StatusCode.NotFound,"Booking/lot not found"));
            vehicle=r.GetGuid(0);state=r.GetString(1);expiry=r.IsDBNull(2)?null:r.GetDateTime(2);quote=checked((long)r.GetDecimal(3));slot=r.IsDBNull(4)?null:r.GetGuid(4);
        }
        await using(var locks=new NpgsqlCommand("SELECT lock_parking_resource('VEHICLE',@vehicle)",conn,tx))
        {locks.Parameters.AddWithValue("vehicle",vehicle);await locks.ExecuteNonQueryAsync(ct);}
        var currentSlots=new SortedSet<Guid>();
        await using(var slots=new NpgsqlCommand("SELECT slot_id FROM slot_reservations WHERE booking_id=@id AND status IN ('HELD','CONFIRMED')",conn,tx))
        {slots.Parameters.AddWithValue("id",booking);await using var r=await slots.ExecuteReaderAsync(ct);while(await r.ReadAsync(ct))currentSlots.Add(r.GetGuid(0));}
        foreach(var currentSlot in currentSlots)
        {await using var locks=new NpgsqlCommand("SELECT lock_parking_resource('SLOT',@slot)",conn,tx);locks.Parameters.AddWithValue("slot",currentSlot);await locks.ExecuteNonQueryAsync(ct);}
        // Read current state only AFTER locking; state read above is not authoritative.
        await using(var current=new NpgsqlCommand("SELECT status::text,hold_expires_at,estimated_amount FROM bookings WHERE id=@id FOR UPDATE",conn,tx))
        {current.Parameters.AddWithValue("id",booking);await using var r=await current.ExecuteReaderAsync(ct);await r.ReadAsync(ct);state=r.GetString(0);expiry=r.IsDBNull(1)?null:r.GetDateTime(1);quote=checked((long)r.GetDecimal(2));}
        await using(var receipt=new NpgsqlCommand("INSERT INTO payment_receipts(payment_id,booking_id,amount,currency,paid_at,event_id) VALUES(@payment,@booking,@amount,@currency,@paid,@event) ON CONFLICT(payment_id) DO NOTHING",conn,tx))
        {
            receipt.Parameters.AddWithValue("payment",paymentId);receipt.Parameters.AddWithValue("booking",booking);receipt.Parameters.AddWithValue("amount",request.AmountMinor);
            receipt.Parameters.AddWithValue("currency",request.Currency);receipt.Parameters.AddWithValue("paid",paid);receipt.Parameters.AddWithValue("event",eventId);
            if(await receipt.ExecuteNonQueryAsync(ct)==0)throw new RpcException(new Status(StatusCode.AlreadyExists,"Payment already delivered using another event ID"));
        }
        long total;bool reservation;
        await using(var sums=new NpgsqlCommand("""
            SELECT (SELECT coalesce(sum(amount),0) FROM payment_receipts WHERE booking_id=@id),
              EXISTS(SELECT 1 FROM slot_reservations s WHERE s.booking_id=@id AND s.status='HELD'
                AND NOT EXISTS(SELECT 1 FROM session_slot_assignments a WHERE a.slot_id=s.slot_id AND a.vacated_at IS NULL))
            """,conn,tx))
        {sums.Parameters.AddWithValue("id",booking);await using var r=await sums.ExecuteReaderAsync(ct);await r.ReadAsync(ct);total=checked((long)r.GetDecimal(0));reservation=r.GetBoolean(1);}
        var outcome=PaymentDecision.ForBooking(state,expiry is null||expiry<=DateTime.UtcNow,total,quote,reservation);
        if(outcome=="CONFIRMED")
        {
            await using var confirm=new NpgsqlCommand("UPDATE bookings SET status='CONFIRMED',version=version+1 WHERE id=@id; UPDATE slot_reservations SET status='CONFIRMED' WHERE booking_id=@id AND status='HELD'",conn,tx);
            confirm.Parameters.AddWithValue("id",booking);await confirm.ExecuteNonQueryAsync(ct);
        }
        else if(state=="PENDING_PAYMENT" && expiry<=DateTime.UtcNow)
        {
            await using var expire=new NpgsqlCommand("UPDATE bookings SET status='EXPIRED',version=version+1 WHERE id=@id; UPDATE slot_reservations SET status='RELEASED',released_at=now(),release_reason='LATE_PAYMENT' WHERE booking_id=@id AND status='HELD'",conn,tx);
            expire.Parameters.AddWithValue("id",booking);await expire.ExecuteNonQueryAsync(ct);
        }
        await using(var inbox=new NpgsqlCommand("""
            INSERT INTO integration_inbox(event_id,event_type,payload_hash,outcome) VALUES(@event,'PaymentSucceeded.v1',@hash,@outcome);
            INSERT INTO audit_logs(id,lot_id,actor_type,action,entity_type,entity_id,request_id,reason,created_at)
            VALUES(gen_random_uuid(),@lot,'SERVICE','PAYMENT_RECEIVED','BOOKING',@entity,@request,@outcome,now());
            """,conn,tx))
        {inbox.Parameters.AddWithValue("event",eventId);inbox.Parameters.AddWithValue("hash",hash);inbox.Parameters.AddWithValue("outcome",outcome);inbox.Parameters.AddWithValue("lot",lot);inbox.Parameters.AddWithValue("entity",booking.ToString());inbox.Parameters.AddWithValue("request",eventId.ToString());await inbox.ExecuteNonQueryAsync(ct);}
        await tx.CommitAsync(ct);return new DeliveryReply{Outcome=outcome};
    }
}
