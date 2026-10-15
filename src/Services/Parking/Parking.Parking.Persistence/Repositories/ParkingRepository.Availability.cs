using System.Data;
using Npgsql;
using NpgsqlTypes;
using Parking.Parking.Application.DTOs;
using Parking.Parking.Application.Exceptions;
using Parking.Parking.Domain;
using Parking.ServiceDefaults;

namespace Parking.Parking.Persistence.Repositories;

public sealed partial class ParkingRepository
{
    public async Task<LotAvailabilityDto> GetLotAvailabilityAsync(Guid lotId,
        DateTimeOffset? startTime, DateTimeOffset? endTime, string? vehicleType,
        Guid? levelId, CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        var start = startTime ?? now;
        if (lotId == Guid.Empty || levelId == Guid.Empty)
            throw new ServiceException(400, "Non-empty lot and level IDs are required.");
        if (endTime is null && start > DateTimeOffset.MaxValue.AddHours(-1))
            throw new ServiceException(400, "Time range is outside supported bounds.");
        var end = endTime ?? start.AddHours(1);
        if (end <= start || end - start > TimeSpan.FromDays(31))
            throw new ServiceException(400, "Time range must be positive and at most 31 days.");
        var type = string.IsNullOrWhiteSpace(vehicleType) ? null : vehicleType.Trim().ToUpperInvariant();
        if (type is { Length: > 30 }) throw new ServiceException(400, "Vehicle type is too long.");

        await using var conn = await db.OpenConnectionAsync(ct);
        // One coherent snapshot for lot, hours, floors and slot counters; no write locks.
        await using var tx = await conn.BeginTransactionAsync(IsolationLevel.RepeatableRead, ct);
        string lotCode;
        string timezone;
        await using (var cmd = new NpgsqlCommand("SELECT code,timezone,status FROM parking_lots WHERE id=@lot", conn, tx))
        {
            cmd.Parameters.AddWithValue("lot", lotId);
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            if (!await reader.ReadAsync(ct)) throw new NotFoundException("Parking lot not found.");
            lotCode = reader.GetString(0);
            timezone = reader.GetString(1);
            if (reader.GetString(2) != "ACTIVE") throw new ServiceException(409, "Parking lot is not active.");
        }
        var intervals = new List<(int From, int To)>();
        await using (var cmd = new NpgsqlCommand("SELECT start_minute,end_minute FROM lot_opening_intervals WHERE lot_id=@lot", conn, tx))
        {
            cmd.Parameters.AddWithValue("lot", lotId);
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct)) intervals.Add((reader.GetInt32(0), reader.GetInt32(1)));
        }
        TimeZoneInfo tz;
        try { tz = TimeZoneInfo.FindSystemTimeZoneById(timezone); }
        catch (TimeZoneNotFoundException) { throw new ServiceException(503, "Lot timezone configuration is invalid."); }
        catch (InvalidTimeZoneException) { throw new ServiceException(503, "Lot timezone configuration is invalid."); }
        if (!LotOperatingHours.Covers(start, end, tz, intervals))
            throw new ServiceException(409, "Requested interval is outside lot operating hours.");
        await using (var cmd = new NpgsqlCommand("SELECT EXISTS(SELECT 1 FROM lot_closures WHERE lot_id=@lot AND tstzrange(starts_at,ends_at,'[)') && tstzrange(@start,@end,'[)'))", conn, tx))
        {
            cmd.Parameters.AddWithValue("lot", lotId);
            cmd.Parameters.AddWithValue("start", start.UtcDateTime);
            cmd.Parameters.AddWithValue("end", end.UtcDateTime);
            if ((bool)(await cmd.ExecuteScalarAsync(ct))!) throw new ServiceException(409, "Lot is closed during the requested interval.");
        }
        if (type is not null)
        {
            await using var cmd = new NpgsqlCommand("SELECT EXISTS(SELECT 1 FROM lot_vehicle_policies WHERE lot_id=@lot AND vehicle_type=@type)", conn, tx);
            cmd.Parameters.AddWithValue("lot", lotId);
            cmd.Parameters.AddWithValue("type", type);
            if (!(bool)(await cmd.ExecuteScalarAsync(ct))!) throw new ServiceException(400, "Vehicle type is not supported by this lot.");
        }
        var levels = new Dictionary<Guid, (string Code, string Name, int Order, List<SlotAvailabilityItemDto> Slots)>();
        await using (var cmd = new NpgsqlCommand("SELECT id,code,name,display_order FROM parking_levels WHERE lot_id=@lot AND (@level IS NULL OR id=@level) ORDER BY display_order,code", conn, tx))
        {
            cmd.Parameters.AddWithValue("lot", lotId);
            cmd.Parameters.Add("level", NpgsqlDbType.Uuid).Value = (object?)levelId ?? DBNull.Value;
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct)) levels.Add(reader.GetGuid(0), (reader.GetString(1),reader.GetString(2),reader.GetInt32(3),[]));
        }
        if (levelId is not null && levels.Count == 0) throw new NotFoundException("Level not found in this parking lot.");
        const string sql = """
            SELECT s.id,s.code,s.level_id,z.code,s.operational_status::text,
              COALESCE((SELECT array_agg(v.vehicle_type ORDER BY v.vehicle_type) FROM slot_vehicle_types v
                WHERE v.slot_id=s.id AND v.lot_id=s.lot_id),ARRAY[]::text[]),
              COALESCE((SELECT array_agg(f.feature_code ORDER BY f.feature_code) FROM slot_feature_links f
                WHERE f.slot_id=s.id),ARRAY[]::text[]),
              EXISTS(SELECT 1 FROM session_slot_assignments a WHERE a.slot_id=s.id AND a.vacated_at IS NULL),
              EXISTS(SELECT 1 FROM slot_reservations r JOIN bookings b ON b.id=r.booking_id
                WHERE r.slot_id=s.id AND tstzrange(r.starts_at,r.ends_at,'[)') && tstzrange(@start,@end,'[)')
                AND ((r.status='HELD' AND b.status='PENDING_PAYMENT' AND b.hold_expires_at>@now)
                  OR (r.status='CONFIRMED' AND b.status IN ('CONFIRMED','CHECKED_IN'))))
            FROM parking_slots s JOIN zones z ON z.id=s.zone_id AND z.lot_id=s.lot_id
            WHERE s.lot_id=@lot AND (@level IS NULL OR s.level_id=@level)
              AND (@type IS NULL OR EXISTS(SELECT 1 FROM slot_vehicle_types v
                WHERE v.slot_id=s.id AND v.lot_id=s.lot_id AND v.vehicle_type=@type))
            ORDER BY s.code,s.id
            """;
        var counts = new Dictionary<string,int> { ["AVAILABLE"]=0,["HELD"]=0,["OCCUPIED"]=0,["MAINTENANCE"]=0 };
        await using (var cmd = new NpgsqlCommand(sql, conn, tx))
        {
            cmd.Parameters.AddWithValue("lot", lotId);
            cmd.Parameters.Add("level", NpgsqlDbType.Uuid).Value = (object?)levelId ?? DBNull.Value;
            cmd.Parameters.Add("type", NpgsqlDbType.Text).Value = (object?)type ?? DBNull.Value;
            cmd.Parameters.AddWithValue("start", start.UtcDateTime);
            cmd.Parameters.AddWithValue("end", end.UtcDateTime);
            cmd.Parameters.AddWithValue("now", now.UtcDateTime);
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                // Occupancy describes physical presence, even if the slot is subsequently disabled.
                var status = reader.GetBoolean(7) ? "OCCUPIED" : reader.GetString(4) != "ACTIVE" ? "MAINTENANCE"
                    : reader.GetBoolean(8) ? "HELD" : "AVAILABLE";
                counts[status]++;
                levels[reader.GetGuid(2)].Slots.Add(new SlotAvailabilityItemDto(reader.GetGuid(0),reader.GetString(1),
                    reader.GetString(3),reader.GetFieldValue<string[]>(5),reader.GetFieldValue<string[]>(6),status));
            }
        }
        await tx.CommitAsync(ct);
        return new LotAvailabilityDto(lotId,lotCode,new QueryTimeRangeDto(start,end),counts.Values.Sum(),
            counts["AVAILABLE"],counts["HELD"],counts["OCCUPIED"],counts["MAINTENANCE"],
            levels.OrderBy(x=>x.Value.Order).ThenBy(x=>x.Value.Code).Select(x=>
                new LevelAvailabilityItemDto(x.Key,x.Value.Code,x.Value.Name,x.Value.Slots)).ToList());
    }
}
