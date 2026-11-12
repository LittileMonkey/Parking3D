using Npgsql;
using Parking.ServiceDefaults;
using System.Text.Json;

namespace Parking.Parking.Persistence;

public sealed record ReallocateBooking(Guid TargetSlotId, int ExpectedVersion, string Reason);

public sealed class SlotReallocationRepository(NpgsqlDataSource db)
{
    public async Task<JsonElement> ListAsync(Guid lot, CancellationToken ct)
    {
        await using var cmd=db.CreateCommand("""
            SELECT coalesce(jsonb_agg(row_to_json(x)),'[]'::jsonb)::text FROM (
              SELECT b.id AS "bookingId",b.code,b.version,b.vehicle_type AS "vehicleType",r.slot_id AS "slotId",
                s.code AS "slotCode",b.starts_at AS "startsAt",b.ends_at AS "endsAt",b.status::text
              FROM bookings b JOIN slot_reservations r ON r.booking_id=b.id JOIN parking_slots s ON s.id=r.slot_id
              WHERE b.lot_id=@lot AND b.status IN ('PENDING_PAYMENT','CONFIRMED') AND r.status IN ('HELD','CONFIRMED')
                AND ((b.status='PENDING_PAYMENT' AND b.hold_expires_at>now()) OR (b.status='CONFIRMED' AND b.arrival_deadline>now()))
              ORDER BY b.starts_at LIMIT 500
            ) x
            """);
        cmd.Parameters.AddWithValue("lot",lot);
        return JsonSerializer.Deserialize<JsonElement>((string)(await cmd.ExecuteScalarAsync(ct))!);
    }

    public async Task MoveAsync(Guid lot, Guid booking, Guid actor, ReallocateBooking request, CancellationToken ct)
    {
        if(request.TargetSlotId==Guid.Empty||request.ExpectedVersion<1||string.IsNullOrWhiteSpace(request.Reason)||request.Reason.Length>2000)
            throw new ServiceException(400,"Target slot, version and reason are required");
        await using var conn=await db.OpenConnectionAsync(ct);await using var tx=await conn.BeginTransactionAsync(ct);
        Guid vehicle;
        await using(var find=new NpgsqlCommand("SELECT vehicle_id FROM bookings WHERE id=@id AND lot_id=@lot",conn,tx))
        {find.Parameters.AddWithValue("id",booking);find.Parameters.AddWithValue("lot",lot);vehicle=await find.ExecuteScalarAsync(ct) is Guid v?v:throw new ServiceException(404,"Booking not found in lot");}
        await using(var claim=new NpgsqlCommand("SELECT lock_parking_resource('VEHICLE',@vehicle)",conn,tx))
        {claim.Parameters.AddWithValue("vehicle",vehicle);await claim.ExecuteNonQueryAsync(ct);}
        Guid source;
        await using(var find=new NpgsqlCommand("SELECT slot_id FROM slot_reservations WHERE booking_id=@id AND status IN ('HELD','CONFIRMED')",conn,tx))
        {find.Parameters.AddWithValue("id",booking);source=await find.ExecuteScalarAsync(ct) is Guid id?id:throw new ServiceException(409,"Booking no longer has an active reservation");}
        if(source==request.TargetSlotId)throw new ServiceException(400,"Choose another slot");
        foreach(var slot in new[]{source,request.TargetSlotId}.OrderBy(x=>x))
        {await using var claim=new NpgsqlCommand("SELECT lock_parking_resource('SLOT',@slot)",conn,tx);claim.Parameters.AddWithValue("slot",slot);await claim.ExecuteNonQueryAsync(ct);}
        await using(var valid=new NpgsqlCommand("""
            SELECT b.id FROM bookings b JOIN slot_reservations r ON r.booking_id=b.id
            WHERE b.id=@id AND b.lot_id=@lot AND b.version=@version AND r.slot_id=@source AND r.status IN ('HELD','CONFIRMED')
              AND ((b.status='PENDING_PAYMENT' AND b.hold_expires_at>clock_timestamp()) OR (b.status='CONFIRMED' AND b.arrival_deadline>clock_timestamp()))
              AND NOT EXISTS(SELECT 1 FROM parking_sessions p WHERE p.booking_id=b.id)
            FOR UPDATE OF b,r
            """,conn,tx))
        {
            valid.Parameters.AddWithValue("id",booking);valid.Parameters.AddWithValue("lot",lot);valid.Parameters.AddWithValue("version",request.ExpectedVersion);valid.Parameters.AddWithValue("source",source);
            if(await valid.ExecuteScalarAsync(ct) is null)throw new ServiceException(409,"Booking changed, expired or already checked in");
        }
        await using(var compatible=new NpgsqlCommand("""
            SELECT EXISTS(SELECT 1 FROM parking_slots s JOIN slot_vehicle_types v ON v.slot_id=s.id
              JOIN bookings b ON b.id=@id AND b.lot_id=s.lot_id AND b.vehicle_type=v.vehicle_type
              WHERE s.id=@target AND s.lot_id=@lot AND s.operational_status='ACTIVE'
                AND NOT EXISTS(SELECT 1 FROM session_slot_assignments a WHERE a.slot_id=s.id AND a.vacated_at IS NULL)
                AND NOT EXISTS(SELECT 1 FROM slot_reservations r WHERE r.slot_id=s.id AND r.status IN ('HELD','CONFIRMED')
                  AND tstzrange(r.starts_at,r.ends_at,'[)') && tstzrange(b.starts_at,b.ends_at,'[)'))
                AND NOT EXISTS(SELECT feature_code FROM slot_feature_links WHERE slot_id=@source
                  EXCEPT SELECT feature_code FROM slot_feature_links WHERE slot_id=@target)
                AND NOT EXISTS(SELECT 1 FROM slot_feature_links f WHERE f.slot_id=@target AND f.feature_code IN ('ACCESSIBLE','PRIORITY','EV','EV_CHARGING')
                  AND NOT EXISTS(SELECT 1 FROM slot_feature_links old WHERE old.slot_id=@source AND old.feature_code=f.feature_code)))
            """,conn,tx))
        {
            compatible.Parameters.AddWithValue("id",booking);compatible.Parameters.AddWithValue("lot",lot);compatible.Parameters.AddWithValue("source",source);compatible.Parameters.AddWithValue("target",request.TargetSlotId);
            if(!(bool)(await compatible.ExecuteScalarAsync(ct))!)throw new ServiceException(409,"Target must be compatible, active and free throughout the booking window");
        }
        await using(var write=new NpgsqlCommand("""
            UPDATE slot_reservations SET slot_id=@target WHERE booking_id=@id AND status IN ('HELD','CONFIRMED');
            UPDATE bookings SET version=version+1 WHERE id=@id;
            INSERT INTO audit_logs(lot_id,actor_user_id,actor_type,action,entity_type,entity_id,reason,old_values,new_values)
              VALUES(@lot,@actor,'USER','REALLOCATE_BOOKING','BOOKING',@entity,@reason,
                jsonb_build_object('slotId',@source),jsonb_build_object('slotId',@target));
            """,conn,tx))
        {
            write.Parameters.AddWithValue("id",booking);write.Parameters.AddWithValue("lot",lot);write.Parameters.AddWithValue("actor",actor);
            write.Parameters.AddWithValue("target",request.TargetSlotId);write.Parameters.AddWithValue("source",source);
            write.Parameters.AddWithValue("entity",booking.ToString());write.Parameters.AddWithValue("reason",request.Reason.Trim());await write.ExecuteNonQueryAsync(ct);
        }
        await tx.CommitAsync(ct);
    }
}
