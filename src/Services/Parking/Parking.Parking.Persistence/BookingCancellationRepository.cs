using Npgsql;
using Parking.ServiceDefaults;
using System.Text.Json;

namespace Parking.Parking.Persistence;

public sealed record CancelBookingRequest(string Reason);

public sealed class BookingCancellationRepository(NpgsqlDataSource db, TimeProvider clock)
{
    public async Task<JsonElement> ListForLotAsync(Guid lot, CancellationToken ct)
    {
        await using var cmd=db.CreateCommand("""
            SELECT coalesce(jsonb_agg(row_to_json(x)),'[]'::jsonb)::text FROM (
              SELECT c.booking_id AS "bookingId",b.code AS "bookingCode",c.requested_at AS "requestedAt",c.reason,
                c.refund_eligible AS "refundEligible",c.refund_status AS "refundStatus",
                coalesce((SELECT sum(p.amount) FROM payment_receipts p WHERE p.booking_id=c.booking_id),0) AS "recordedPaidAmount"
              FROM booking_cancellations c JOIN bookings b ON b.id=c.booking_id
              WHERE c.lot_id=@lot ORDER BY c.requested_at DESC LIMIT 200
            ) x
            """);
        cmd.Parameters.AddWithValue("lot",lot);
        return JsonSerializer.Deserialize<JsonElement>((string)(await cmd.ExecuteScalarAsync(ct))!);
    }

    public async Task<JsonElement> ReadAsync(Guid id, Guid actor, CancellationToken ct)
    {
        await using var cmd=db.CreateCommand("""
            SELECT row_to_json(c)::text FROM booking_cancellations c
            JOIN bookings b ON b.id=c.booking_id WHERE c.booking_id=@id AND b.customer_id=@actor
            """);
        cmd.Parameters.AddWithValue("id",id);cmd.Parameters.AddWithValue("actor",actor);
        var value=await cmd.ExecuteScalarAsync(ct);
        if(value is not string json)throw new ServiceException(404,"Cancellation not found");
        return JsonSerializer.Deserialize<JsonElement>(json);
    }

    public async Task<JsonElement> CancelAsync(Guid id, Guid actor, CancelBookingRequest request, CancellationToken ct)
    {
        if(string.IsNullOrWhiteSpace(request.Reason)||request.Reason.Length>2000)throw new ServiceException(400,"Cancellation reason is required (max 2000 characters)");
        await using var conn=await db.OpenConnectionAsync(ct);await using var tx=await conn.BeginTransactionAsync(ct);
        Guid vehicle;
        await using(var owner=new NpgsqlCommand("SELECT vehicle_id FROM bookings WHERE id=@id AND customer_id=@actor",conn,tx))
        {
            owner.Parameters.AddWithValue("id",id);owner.Parameters.AddWithValue("actor",actor);
            var value=await owner.ExecuteScalarAsync(ct);
            if(value is not Guid v)throw new ServiceException(404,"Booking not found");vehicle=v;
        }
        await using(var claim=new NpgsqlCommand("SELECT lock_parking_resource('VEHICLE',@vehicle)",conn,tx))
        {claim.Parameters.AddWithValue("vehicle",vehicle);await claim.ExecuteNonQueryAsync(ct);}
        var slots=new List<Guid>();
        await using(var read=new NpgsqlCommand("SELECT slot_id FROM slot_reservations WHERE booking_id=@id AND status IN ('HELD','CONFIRMED') ORDER BY slot_id",conn,tx))
        {read.Parameters.AddWithValue("id",id);await using var r=await read.ExecuteReaderAsync(ct);while(await r.ReadAsync(ct))slots.Add(r.GetGuid(0));}
        foreach(var slot in slots)
        {await using var claim=new NpgsqlCommand("SELECT lock_parking_resource('SLOT',@slot)",conn,tx);claim.Parameters.AddWithValue("slot",slot);await claim.ExecuteNonQueryAsync(ct);}
        Guid lot;string state;DateTimeOffset start;int cutoff;
        await using(var read=new NpgsqlCommand("""
            SELECT b.lot_id,b.status::text,b.starts_at,
              coalesce((s.policy_snapshot->>'cancellationRefundCutoffMinutes')::int,p.cancellation_refund_cutoff_minutes)
            FROM bookings b JOIN pricing_snapshots s ON s.id=b.pricing_snapshot_id
            JOIN lot_vehicle_policies p ON p.lot_id=b.lot_id AND p.vehicle_type=b.vehicle_type
            WHERE b.id=@id AND b.customer_id=@actor FOR UPDATE OF b
            """,conn,tx))
        {
            read.Parameters.AddWithValue("id",id);read.Parameters.AddWithValue("actor",actor);
            await using var r=await read.ExecuteReaderAsync(ct);if(!await r.ReadAsync(ct))throw new ServiceException(404,"Booking not found");
            lot=r.GetGuid(0);state=r.GetString(1);start=r.GetFieldValue<DateTimeOffset>(2);cutoff=r.GetInt32(3);
        }
        if(state=="CANCELLED") {await tx.RollbackAsync(ct);return await ReadAsync(id,actor,ct);}
        if(state is not ("PENDING_PAYMENT" or "CONFIRMED"))throw new ServiceException(409,"Only pending or confirmed bookings can be cancelled");
        await using(var occupied=new NpgsqlCommand("SELECT EXISTS(SELECT 1 FROM parking_sessions WHERE booking_id=@id)",conn,tx))
        {occupied.Parameters.AddWithValue("id",id);if((bool)(await occupied.ExecuteScalarAsync(ct))!)throw new ServiceException(409,"A checked-in vehicle must use checkout, not cancellation");}
        var now=clock.GetUtcNow();var eligible=start-now>TimeSpan.FromMinutes(cutoff);
        await using(var write=new NpgsqlCommand("""
            INSERT INTO booking_cancellations(booking_id,lot_id,requested_by,reason,requested_at,refund_eligible,refund_status)
              VALUES(@id,@lot,@actor,@reason,@now,@eligible,CASE WHEN @eligible THEN 'REVIEW_REQUIRED' ELSE 'NOT_ELIGIBLE' END);
            UPDATE bookings SET status='CANCELLED',cancelled_at=@now,cancellation_reason=@reason,version=version+1 WHERE id=@id;
            UPDATE slot_reservations SET status='RELEASED',released_at=@now,release_reason='CUSTOMER_CANCELLED' WHERE booking_id=@id AND status IN ('HELD','CONFIRMED');
            UPDATE qr_tokens SET revoked_at=@now WHERE booking_id=@id AND revoked_at IS NULL;
            INSERT INTO audit_logs(lot_id,actor_user_id,actor_type,action,entity_type,entity_id,reason,new_values)
              VALUES(@lot,@actor,'USER','CANCEL_BOOKING','BOOKING',@entity,@reason,jsonb_build_object('refundEligible',@eligible));
            """,conn,tx))
        {
            write.Parameters.AddWithValue("id",id);write.Parameters.AddWithValue("lot",lot);write.Parameters.AddWithValue("actor",actor);
            write.Parameters.AddWithValue("reason",request.Reason.Trim());write.Parameters.AddWithValue("now",now.UtcDateTime);
            write.Parameters.AddWithValue("eligible",eligible);write.Parameters.AddWithValue("entity",id.ToString());await write.ExecuteNonQueryAsync(ct);
        }
        await tx.CommitAsync(ct);return await ReadAsync(id,actor,ct);
    }
}
