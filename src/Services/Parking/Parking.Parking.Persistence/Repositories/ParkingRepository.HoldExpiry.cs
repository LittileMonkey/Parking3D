using System.Data;
using Npgsql;
using NpgsqlTypes;

namespace Parking.Parking.Persistence.Repositories;

public sealed partial class ParkingRepository
{
    // Chỉ hết hạn hold pending; không giải phóng slot đang có xe vật lý.
    /// <summary>Xử lý tối đa 100 hold pending hết hạn; kiểm tra lại dưới khóa, bảo vệ booking đã xác nhận và xe đang đỗ vật lý.</summary>
    public Task<int> ExpireHoldsAsync(CancellationToken ct) => ExpireHoldsAsync(ct, null, null);

    /// <summary>Xử lý tối đa 100 hold pending hết hạn; kiểm tra lại dưới khóa, bảo vệ booking đã xác nhận và xe đang đỗ vật lý.</summary>
    private async Task<int> ExpireHoldsAsync(CancellationToken ct, Guid? vehicleId, Guid? slotId)
    {
        var candidates = new List<(Guid Booking, Guid Vehicle)>();
        await using var conn = await db.OpenConnectionAsync(ct);
        await using (var cmd = new NpgsqlCommand("""
            SELECT id,vehicle_id FROM bookings b
            WHERE status='PENDING_PAYMENT' AND hold_expires_at<=@now
              AND NOT EXISTS(SELECT 1 FROM slot_reservations r WHERE r.booking_id=b.id AND r.status='CONFIRMED')
              AND NOT EXISTS(SELECT 1 FROM slot_reservations r JOIN session_slot_assignments a ON a.slot_id=r.slot_id
                WHERE r.booking_id=b.id AND r.status='HELD' AND a.vacated_at IS NULL)
              AND (@vehicle IS NULL OR vehicle_id=@vehicle OR EXISTS(
                SELECT 1 FROM slot_reservations r WHERE r.booking_id=b.id AND r.slot_id=@slot AND r.status='HELD'))
            ORDER BY hold_expires_at,id LIMIT 100
            """, conn))
        {
            cmd.Parameters.AddWithValue("now", clock.GetUtcNow().UtcDateTime);
            cmd.Parameters.Add("vehicle", NpgsqlDbType.Uuid).Value = (object?)vehicleId ?? DBNull.Value;
            cmd.Parameters.Add("slot", NpgsqlDbType.Uuid).Value = (object?)slotId ?? DBNull.Value;
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct)) candidates.Add((reader.GetGuid(0), reader.GetGuid(1)));
        }
        // Mỗi booking có transaction riêng; khi worker quét nền (vehicleId == null), lỗi DB trên 1 booking sẽ rollback và không chặn các booking còn lại.
        var count = 0;
        var isolateFailures = vehicleId is null;
        foreach (var candidate in candidates)
        {
            if (await TryExpireCandidateAsync(conn, candidate.Booking, candidate.Vehicle, isolateFailures, ct))
            {
                count++;
            }
        }
        return count;
    }

    private async Task<bool> TryExpireCandidateAsync(
        NpgsqlConnection conn,
        Guid bookingId,
        Guid vehicleId,
        bool isolateFailures,
        CancellationToken ct)
    {
        NpgsqlTransaction? tx = null;
        try
        {
            tx = await conn.BeginTransactionAsync(ct);
            await using (var cmd = new NpgsqlCommand("SELECT lock_parking_resource('VEHICLE',@vehicle)", conn, tx))
            {
                cmd.Parameters.AddWithValue("vehicle", vehicleId);
                await cmd.ExecuteNonQueryAsync(ct);
            }
            // Sắp xếp slot để mọi luồng lấy khóa cùng thứ tự, giảm nguy cơ deadlock.
            var slots = new SortedSet<Guid>();
            await using (var cmd = new NpgsqlCommand("SELECT slot_id FROM slot_reservations WHERE booking_id=@id AND status IN ('HELD','CONFIRMED')", conn, tx))
            {
                cmd.Parameters.AddWithValue("id", bookingId);
                await using var reader = await cmd.ExecuteReaderAsync(ct);
                while (await reader.ReadAsync(ct)) slots.Add(reader.GetGuid(0));
            }
            foreach (var slot in slots)
            {
                await using var cmd = new NpgsqlCommand("SELECT lock_parking_resource('SLOT',@slot)", conn, tx);
                cmd.Parameters.AddWithValue("slot", slot);
                await cmd.ExecuteNonQueryAsync(ct);
            }
            // Danh sách ban đầu chỉ để chọn ứng viên; phải kiểm tra lại dưới khóa dùng chung với payment/booking.
            // Đọc lại đồng hồ sau khi lấy khóa; thời gian quét ứng viên có thể đã cũ.
            await using (var cmd = new NpgsqlCommand("SELECT id FROM bookings WHERE id=@id AND vehicle_id=@vehicle AND status='PENDING_PAYMENT' AND hold_expires_at<=@now FOR UPDATE", conn, tx))
            {
                cmd.Parameters.AddWithValue("now", clock.GetUtcNow().UtcDateTime);
                cmd.Parameters.AddWithValue("id", bookingId);
                cmd.Parameters.AddWithValue("vehicle", vehicleId);
                if (await cmd.ExecuteScalarAsync(ct) is null)
                {
                    await tx.RollbackAsync(ct);
                    return false;
                }
            }
            var currentSlots = new SortedSet<Guid>();
            var protectedResource = false;
            await using (var cmd = new NpgsqlCommand("""
                SELECT r.slot_id,r.status::text,EXISTS(SELECT 1 FROM session_slot_assignments a
                  WHERE a.slot_id=r.slot_id AND a.vacated_at IS NULL)
                FROM slot_reservations r WHERE r.booking_id=@id AND r.status IN ('HELD','CONFIRMED') FOR UPDATE OF r
                """, conn, tx))
            {
                cmd.Parameters.AddWithValue("id", bookingId);
                await using var reader = await cmd.ExecuteReaderAsync(ct);
                while (await reader.ReadAsync(ct))
                {
                    currentSlots.Add(reader.GetGuid(0));
                    protectedResource |= reader.GetString(1) != "HELD" || reader.GetBoolean(2);
                }
            }
            if (protectedResource || !currentSlots.SetEquals(slots))
            {
                await tx.RollbackAsync(ct);
                return false;
            }
            await using (var cmd = new NpgsqlCommand("""
                UPDATE slot_reservations SET status='RELEASED',released_at=clock_timestamp(),release_reason='HOLD_EXPIRED'
                  WHERE booking_id=@id AND status='HELD';
                UPDATE bookings SET status='EXPIRED',version=version+1
                  WHERE id=@id AND status='PENDING_PAYMENT';
                INSERT INTO audit_logs(id,lot_id,actor_type,action,entity_type,entity_id,reason,created_at)
                  SELECT gen_random_uuid(),lot_id,'SYSTEM','EXPIRE_HOLD','BOOKING',id::text,'Configured hold deadline elapsed',clock_timestamp()
                  FROM bookings WHERE id=@id;
                """, conn, tx))
            {
                cmd.Parameters.AddWithValue("id", bookingId);
                await cmd.ExecuteNonQueryAsync(ct);
            }
            await tx.CommitAsync(ct);
            return true;
        }
        catch (PostgresException) when (isolateFailures && !ct.IsCancellationRequested && conn.State == ConnectionState.Open)
        {
            if (tx is not null && conn.State == ConnectionState.Open)
            {
                await tx.RollbackAsync(CancellationToken.None);
            }
            return false;
        }
        finally
        {
            if (tx is not null) await tx.DisposeAsync();
        }
    }
}
