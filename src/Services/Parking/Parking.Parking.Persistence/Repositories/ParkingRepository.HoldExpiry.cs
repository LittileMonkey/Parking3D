using Npgsql;
using NpgsqlTypes;

namespace Parking.Parking.Persistence.Repositories;

public sealed partial class ParkingRepository
{
    public Task<int> ExpireHoldsAsync(CancellationToken ct) => ExpireHoldsAsync(ct, null, null);

    private async Task<int> ExpireHoldsAsync(CancellationToken ct, Guid? vehicleId, Guid? slotId)
    {
        var candidates = new List<(Guid Booking, Guid Vehicle)>();
        await using var conn = await db.OpenConnectionAsync(ct);
        await using (var cmd = new NpgsqlCommand("""
            SELECT id,vehicle_id FROM bookings b
            WHERE status='PENDING_PAYMENT' AND hold_expires_at<=clock_timestamp()
              AND NOT EXISTS(SELECT 1 FROM slot_reservations r WHERE r.booking_id=b.id AND r.status='CONFIRMED')
              AND NOT EXISTS(SELECT 1 FROM slot_reservations r JOIN session_slot_assignments a ON a.slot_id=r.slot_id
                WHERE r.booking_id=b.id AND r.status='HELD' AND a.vacated_at IS NULL)
              AND (@vehicle IS NULL OR vehicle_id=@vehicle OR EXISTS(
                SELECT 1 FROM slot_reservations r WHERE r.booking_id=b.id AND r.slot_id=@slot AND r.status='HELD'))
            ORDER BY hold_expires_at,id LIMIT 100
            """, conn))
        {
            cmd.Parameters.Add("vehicle", NpgsqlDbType.Uuid).Value = (object?)vehicleId ?? DBNull.Value;
            cmd.Parameters.Add("slot", NpgsqlDbType.Uuid).Value = (object?)slotId ?? DBNull.Value;
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct)) candidates.Add((reader.GetGuid(0),reader.GetGuid(1)));
        }
        var count = 0;
        foreach (var candidate in candidates)
        {
            await using var tx = await conn.BeginTransactionAsync(ct);
            await using (var cmd = new NpgsqlCommand("SELECT lock_parking_resource('VEHICLE',@vehicle)",conn,tx))
            {
                cmd.Parameters.AddWithValue("vehicle",candidate.Vehicle);
                await cmd.ExecuteNonQueryAsync(ct);
            }
            var slots = new SortedSet<Guid>();
            await using (var cmd = new NpgsqlCommand("SELECT slot_id FROM slot_reservations WHERE booking_id=@id AND status IN ('HELD','CONFIRMED')",conn,tx))
            {
                cmd.Parameters.AddWithValue("id",candidate.Booking);
                await using var reader = await cmd.ExecuteReaderAsync(ct);
                while(await reader.ReadAsync(ct)) slots.Add(reader.GetGuid(0));
            }
            foreach (var slot in slots)
            {
                await using var cmd = new NpgsqlCommand("SELECT lock_parking_resource('SLOT',@slot)",conn,tx);
                cmd.Parameters.AddWithValue("slot",slot);
                await cmd.ExecuteNonQueryAsync(ct);
            }
            // The candidate list is only a hint. Recheck under the same resource locks as payment/booking.
            await using (var cmd = new NpgsqlCommand("SELECT id FROM bookings WHERE id=@id AND vehicle_id=@vehicle AND status='PENDING_PAYMENT' AND hold_expires_at<=clock_timestamp() FOR UPDATE",conn,tx))
            {
                cmd.Parameters.AddWithValue("id",candidate.Booking);
                cmd.Parameters.AddWithValue("vehicle",candidate.Vehicle);
                if (await cmd.ExecuteScalarAsync(ct) is null) continue;
            }
            var currentSlots = new SortedSet<Guid>();
            var protectedResource = false;
            await using (var cmd = new NpgsqlCommand("""
                SELECT r.slot_id,r.status::text,EXISTS(SELECT 1 FROM session_slot_assignments a
                  WHERE a.slot_id=r.slot_id AND a.vacated_at IS NULL)
                FROM slot_reservations r WHERE r.booking_id=@id AND r.status IN ('HELD','CONFIRMED') FOR UPDATE OF r
                """,conn,tx))
            {
                cmd.Parameters.AddWithValue("id",candidate.Booking);
                await using var reader=await cmd.ExecuteReaderAsync(ct);
                while(await reader.ReadAsync(ct))
                {
                    currentSlots.Add(reader.GetGuid(0));
                    protectedResource |= reader.GetString(1)!="HELD" || reader.GetBoolean(2);
                }
            }
            if (protectedResource || !currentSlots.SetEquals(slots)) continue;
            await using (var cmd = new NpgsqlCommand("""
                UPDATE slot_reservations SET status='RELEASED',released_at=clock_timestamp(),release_reason='HOLD_EXPIRED'
                  WHERE booking_id=@id AND status='HELD';
                UPDATE bookings SET status='EXPIRED',version=version+1
                  WHERE id=@id AND status='PENDING_PAYMENT';
                INSERT INTO audit_logs(id,lot_id,actor_type,action,entity_type,entity_id,reason,created_at)
                  SELECT gen_random_uuid(),lot_id,'SYSTEM','EXPIRE_HOLD','BOOKING',id::text,'Configured hold deadline elapsed',clock_timestamp()
                  FROM bookings WHERE id=@id;
                """,conn,tx))
            {
                cmd.Parameters.AddWithValue("id",candidate.Booking);
                await cmd.ExecuteNonQueryAsync(ct);
            }
            await tx.CommitAsync(ct);
            count++;
        }
        return count;
    }
}
