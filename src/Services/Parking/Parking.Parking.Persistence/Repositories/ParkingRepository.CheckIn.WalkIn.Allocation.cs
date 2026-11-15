using Npgsql;
using Parking.ServiceDefaults;

namespace Parking.Parking.Persistence.Repositories;

public sealed partial class ParkingRepository
{
    // Commands are supplied by the caller and share its transaction and verified IDs.
    private static async Task<(Guid SlotId, string SlotCode, string LevelName)> AllocateWalkInSlotAsync(Func<string, NpgsqlCommand> command, NpgsqlTransaction transaction, DateTimeOffset entryAt, DateTimeOffset endsAt, CancellationToken ct)
    {
        // 7. Rank AUTO_SLOT candidates using the published map, then lock in order.
        Guid slotId = Guid.Empty;
        string slotCode = string.Empty;
        string levelName = string.Empty;
        var candidates = new List<(Guid Id, string Code, string Level)>();
        await using (var slotSearch = command("""
            WITH published_map AS (
                SELECT id
                FROM map_versions
                WHERE lot_id = @lot AND status = 'PUBLISHED'
                ORDER BY version_no DESC
                LIMIT 1
            )
            SELECT s.id, s.code, lvl.name
            FROM parking_slots s
            JOIN parking_levels lvl ON lvl.id = s.level_id AND lvl.lot_id = s.lot_id
            JOIN slot_vehicle_types svt ON svt.slot_id = s.id AND svt.lot_id = s.lot_id
            LEFT JOIN published_map pm ON TRUE
            LEFT JOIN map_objects mo_slot
              ON mo_slot.slot_id = s.id AND mo_slot.lot_id = s.lot_id AND mo_slot.map_version_id = pm.id
            LEFT JOIN map_objects mo_gate
              ON mo_gate.gate_id = @gate AND mo_gate.lot_id = s.lot_id AND mo_gate.map_version_id = pm.id
            WHERE s.lot_id = @lot
              AND s.operational_status = 'ACTIVE'
              AND svt.vehicle_type = @type
              AND NOT EXISTS (
                  SELECT 1 FROM session_slot_assignments a
                  WHERE a.slot_id = s.id AND a.vacated_at IS NULL
              )
              AND NOT EXISTS (
                  SELECT 1 FROM slot_reservations sr
                  JOIN bookings b ON b.id = sr.booking_id
                  WHERE sr.slot_id = s.id
                    AND (
                        sr.status = 'CONFIRMED'
                        OR (sr.status = 'HELD' AND b.status = 'PENDING_PAYMENT' AND b.hold_expires_at > clock_timestamp())
                    )
                    AND tstzrange(sr.starts_at, sr.ends_at, '[)') && tstzrange(@entry, @end, '[)')
              )
            ORDER BY
              COALESCE(SQRT(POWER(mo_slot.x - mo_gate.x, 2) + POWER(mo_slot.y - mo_gate.y, 2) + POWER(mo_slot.z - mo_gate.z, 2)), 99999) ASC,
              lvl.display_order ASC,
              s.code ASC;
            """))
        {
            slotSearch.Parameters.AddWithValue("entry", entryAt.UtcDateTime);
            slotSearch.Parameters.AddWithValue("end", endsAt.UtcDateTime);
            await using var reader = await slotSearch.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
                candidates.Add((reader.GetGuid(0), reader.GetString(1), reader.GetString(2)));
        }

        // Match booking/operations: VEHICLE -> SLOT advisory -> row lock.
        // Never wait on a candidate. Roll back its savepoint to release any lock
        // acquired for a rejected candidate before trying the next nearest slot.
        foreach (var candidate in candidates)
        {
            await transaction.SaveAsync("auto_slot_candidate", ct);
            await using var slotLock = command(
                "SELECT pg_try_advisory_xact_lock(hashtextextended('SLOT:' || @slot::text, 0))");
            slotLock.Parameters.AddWithValue("slot", candidate.Id);
            if ((bool)(await slotLock.ExecuteScalarAsync(ct))!)
            {
                await using var rowLock = command("""
                    SELECT id FROM parking_slots
                    WHERE id=@slot AND lot_id=@lot AND operational_status='ACTIVE'
                    FOR UPDATE SKIP LOCKED
                    """);
                rowLock.Parameters.AddWithValue("slot", candidate.Id);
                if (await rowLock.ExecuteScalarAsync(ct) is Guid)
                {
                    (slotId, slotCode, levelName) = candidate;
                    await transaction.ReleaseAsync("auto_slot_candidate", ct);
                    break;
                }
            }
            await transaction.RollbackAsync("auto_slot_candidate", ct);
            await transaction.ReleaseAsync("auto_slot_candidate", ct);
        }

        if (slotId == Guid.Empty)
            throw new ServiceException(409, "No available slots for this vehicle type at this parking lot.");

        // Xác nhận lại dưới khóa SLOT rằng chưa có session/reservation nào vừa chen vào trước khi lock SLOT.
        await using (var slotDoubleCheck = command("""
            SELECT
                EXISTS (
                    SELECT 1 FROM session_slot_assignments a
                    WHERE a.slot_id = @slot AND a.vacated_at IS NULL
                )
                OR EXISTS (
                    SELECT 1 FROM slot_reservations sr
                    JOIN bookings b ON b.id = sr.booking_id
                    WHERE sr.slot_id = @slot
                      AND (
                          sr.status = 'CONFIRMED'
                          OR (sr.status = 'HELD' AND b.status = 'PENDING_PAYMENT' AND b.hold_expires_at > clock_timestamp())
                      )
                      AND tstzrange(sr.starts_at, sr.ends_at, '[)') && tstzrange(@entry, @end, '[)')
                );
            """))
        {
            slotDoubleCheck.Parameters.AddWithValue("slot", slotId);
            slotDoubleCheck.Parameters.AddWithValue("entry", entryAt.UtcDateTime);
            slotDoubleCheck.Parameters.AddWithValue("end", endsAt.UtcDateTime);
            if ((bool)(await slotDoubleCheck.ExecuteScalarAsync(ct))!)
                throw new ServiceException(409, "Selected slot is no longer available.");
        }

        return (slotId, slotCode, levelName);
    }
}
