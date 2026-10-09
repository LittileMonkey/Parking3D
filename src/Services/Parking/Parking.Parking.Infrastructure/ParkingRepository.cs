using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Npgsql;
using Parking.Parking.Application;
using Parking.Parking.Domain;
using Parking.ServiceDefaults;

namespace Parking.Parking.Infrastructure;

public sealed class ParkingRepository(NpgsqlDataSource db) : IParkingRepository
{
    public async Task<IReadOnlyList<LotView>> ListLotsAsync(CancellationToken ct)
    {
        await using var cmd=db.CreateCommand("SELECT id,code,name,address,latitude,longitude,timezone FROM parking_lots WHERE status='ACTIVE' ORDER BY code");
        await using var r=await cmd.ExecuteReaderAsync(ct); var items=new List<LotView>();
        while(await r.ReadAsync(ct)) items.Add(new LotView(r.GetGuid(0),r.GetString(1),r.GetString(2),r.GetString(3),(double)r.GetDecimal(4),(double)r.GetDecimal(5),r.GetString(6)));
        return items;
    }
    public async Task<bool> LotExistsAsync(Guid lotId,CancellationToken ct)
    {
        await using var cmd=db.CreateCommand("SELECT EXISTS(SELECT 1 FROM parking_lots WHERE id=@lot AND status='ACTIVE')");
        cmd.Parameters.AddWithValue("lot",lotId); return (bool)(await cmd.ExecuteScalarAsync(ct))!;
    }

    public async Task<BookingView> CreateBookingAsync(Guid customerId,BookingRequest request,string key,CancellationToken ct)
    {
        if(request.LotId==Guid.Empty || request.SlotId==Guid.Empty || request.VehicleId==Guid.Empty || request.EndsAt<=request.StartsAt
            || request.StartsAt<DateTimeOffset.UtcNow || string.IsNullOrWhiteSpace(key) || key.Length>128)
            throw new ServiceException(400,"Valid IDs, future time range and Idempotency-Key required");
        await using var conn=await db.OpenConnectionAsync(ct); await using var tx=await conn.BeginTransactionAsync(ct);
        // Claim request key BEFORE executing business writes, under a customer-scoped lock.
        var requestId=new Guid(SHA256.HashData(Encoding.UTF8.GetBytes(customerId+":"+key)).AsSpan(0,16));
        var fingerprint=Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(request))));
        await using(var cmd=new NpgsqlCommand("SELECT pg_advisory_xact_lock(hashtextextended(@key,0)); SELECT lock_parking_resource('VEHICLE',@vehicle);",conn,tx))
        {cmd.Parameters.AddWithValue("key",customerId+":"+key);cmd.Parameters.AddWithValue("vehicle",request.VehicleId);await cmd.ExecuteNonQueryAsync(ct);}
        // Include old expired reservations for this vehicle; every slot being released is locked.
        var affectedSlots=new SortedSet<Guid>{request.SlotId};
        await using(var oldSlots=new NpgsqlCommand("SELECT s.slot_id FROM slot_reservations s JOIN bookings b ON b.id=s.booking_id WHERE b.vehicle_id=@vehicle AND b.status='PENDING_PAYMENT' AND b.hold_expires_at<=now() AND s.status='HELD'",conn,tx))
        {oldSlots.Parameters.AddWithValue("vehicle",request.VehicleId);await using var r=await oldSlots.ExecuteReaderAsync(ct);while(await r.ReadAsync(ct))affectedSlots.Add(r.GetGuid(0));}
        foreach(var affected in affectedSlots)
        {await using var slotLock=new NpgsqlCommand("SELECT lock_parking_resource('SLOT',@slot)",conn,tx);slotLock.Parameters.AddWithValue("slot",affected);await slotLock.ExecuteNonQueryAsync(ct);}
        await using(var old=new NpgsqlCommand("SELECT payload_hash,outcome FROM integration_inbox WHERE event_id=@id AND event_type='BookingRequest'",conn,tx))
        {
            old.Parameters.AddWithValue("id",requestId);await using var r=await old.ExecuteReaderAsync(ct);
            if(await r.ReadAsync(ct))
            {
                if(r.GetString(0)!=fingerprint)throw new ServiceException(409,"Idempotency key reused for another request");
                return JsonSerializer.Deserialize<BookingView>(r.GetString(1))!;
            }
        }
        // Explicit expiry processing is part of the protected transaction.
        await using(var expiry=new NpgsqlCommand("""
            UPDATE slot_reservations SET status='RELEASED',released_at=now(),release_reason='HOLD_EXPIRED'
              WHERE status='HELD' AND booking_id IN (SELECT id FROM bookings WHERE status='PENDING_PAYMENT' AND hold_expires_at<=now()
              AND (vehicle_id=@vehicle OR id IN (SELECT booking_id FROM slot_reservations WHERE slot_id=@slot)));
            UPDATE bookings SET status='EXPIRED',version=version+1 WHERE status='PENDING_PAYMENT' AND hold_expires_at<=now()
              AND (vehicle_id=@vehicle OR id IN (SELECT booking_id FROM slot_reservations WHERE slot_id=@slot));
            """,conn,tx))
        {expiry.Parameters.AddWithValue("vehicle",request.VehicleId);expiry.Parameters.AddWithValue("slot",request.SlotId);await expiry.ExecuteNonQueryAsync(ct);}
        string type; string plate;
        await using(var vehicle=new NpgsqlCommand("""
            SELECT v.vehicle_type,v.plate_normalized FROM vehicles v JOIN user_vehicle_access a ON a.vehicle_id=v.id
            WHERE v.id=@vehicle AND v.is_active AND a.user_id=@user AND a.verified_at IS NOT NULL AND a.revoked_at IS NULL
            """,conn,tx))
        {
            vehicle.Parameters.AddWithValue("vehicle",request.VehicleId);vehicle.Parameters.AddWithValue("user",customerId);
            await using var r=await vehicle.ExecuteReaderAsync(ct); if(!await r.ReadAsync(ct))throw new ServiceException(403,"Verified vehicle access required");
            type=r.GetString(0);plate=r.GetString(1);
        }
        string timezone;int hold;int late;Guid plan;string rulesJson;BlockPrice price;
        await using(var policy=new NpgsqlCommand("""
            SELECT l.timezone,p.hold_minutes,p.min_booking_minutes,p.max_booking_minutes,p.late_arrival_minutes,
              pp.id,pr.parameters::text FROM parking_lots l JOIN lot_vehicle_policies p ON p.lot_id=l.id
              JOIN parking_slots s ON s.lot_id=l.id AND s.id=@slot
              JOIN slot_vehicle_types sv ON sv.slot_id=s.id AND sv.vehicle_type=p.vehicle_type
              JOIN pricing_plans pp ON pp.lot_id=l.id AND pp.vehicle_type=p.vehicle_type
              JOIN pricing_rules pr ON pr.plan_id=pp.id AND pr.rule_type='FLAT_BLOCK'
            WHERE l.id=@lot AND l.status='ACTIVE' AND p.vehicle_type=@type AND s.operational_status='ACTIVE'
              AND pp.status='PUBLISHED' AND pp.currency='VND' AND pp.effective_from<=@start
              AND (pp.effective_until IS NULL OR pp.effective_until>=@end)
              AND NOT EXISTS(SELECT 1 FROM session_slot_assignments x WHERE x.slot_id=s.id AND x.vacated_at IS NULL)
              AND NOT EXISTS(SELECT 1 FROM slot_feature_links f WHERE f.slot_id=s.id AND f.feature_code IN ('ACCESSIBLE','PRIORITY','EV'))
              AND NOT EXISTS(SELECT 1 FROM pricing_rules extra WHERE extra.plan_id=pp.id AND extra.id<>pr.id)
            ORDER BY pp.version_no DESC LIMIT 1
            """,conn,tx))
        {
            policy.Parameters.AddWithValue("slot",request.SlotId);policy.Parameters.AddWithValue("lot",request.LotId);policy.Parameters.AddWithValue("type",type);
            policy.Parameters.AddWithValue("start",request.StartsAt.UtcDateTime);policy.Parameters.AddWithValue("end",request.EndsAt.UtcDateTime);
            await using var r=await policy.ExecuteReaderAsync(ct);if(!await r.ReadAsync(ct))throw new ServiceException(409,"Lot/slot/price unavailable or unsupported pricing rules");
            timezone=r.GetString(0);hold=r.GetInt32(1);late=r.GetInt32(4);plan=r.GetGuid(5);rulesJson=r.GetString(6);
            var minutes=(request.EndsAt-request.StartsAt).TotalMinutes;
            if(minutes<r.GetInt32(2)||minutes>r.GetInt32(3))throw new ServiceException(400,"Booking duration outside configured policy");
            price=JsonSerializer.Deserialize<BlockPrice>(rulesJson,new JsonSerializerOptions{PropertyNameCaseInsensitive=true})??throw new ServiceException(409,"Invalid pricing configuration");
        }
        var tz=TimeZoneInfo.FindSystemTimeZoneById(timezone);price.Validate();
        // Every instant in the requested interval must be covered by local opening intervals.
        await using(var closure=new NpgsqlCommand("SELECT EXISTS(SELECT 1 FROM lot_closures WHERE lot_id=@lot AND tstzrange(starts_at,ends_at,'[)') && tstzrange(@start,@end,'[)'))",conn,tx))
        {
            closure.Parameters.AddWithValue("lot",request.LotId);closure.Parameters.AddWithValue("start",request.StartsAt.UtcDateTime);closure.Parameters.AddWithValue("end",request.EndsAt.UtcDateTime);
            if((bool)(await closure.ExecuteScalarAsync(ct))!)throw new ServiceException(409,"Lot closed during requested interval");
        }
        var intervals=new List<(int From,int To)>();
        await using(var opening=new NpgsqlCommand("SELECT start_minute,end_minute FROM lot_opening_intervals WHERE lot_id=@lot",conn,tx))
        {opening.Parameters.AddWithValue("lot",request.LotId);await using var r=await opening.ExecuteReaderAsync(ct);while(await r.ReadAsync(ct))intervals.Add((r.GetInt32(0),r.GetInt32(1)));}
        for(var at=request.StartsAt;at<request.EndsAt;at=at.AddTicks(TimeSpan.TicksPerMinute-at.UtcTicks%TimeSpan.TicksPerMinute))
        {
            var local=TimeZoneInfo.ConvertTime(at,tz);var minute=(((int)local.DayOfWeek+6)%7)*1440+local.Hour*60+local.Minute;
            if(!intervals.Any(i=>minute>=i.From&&minute<i.To))throw new ServiceException(409,"Outside lot operating hours");
        }
        var id=Guid.NewGuid();var snapshot=Guid.NewGuid();var amount=price.Estimate(request.StartsAt,request.EndsAt,tz);var expires=DateTimeOffset.UtcNow.AddMinutes(hold);
        if(amount<=0)throw new ServiceException(409,"Zero-price booking workflow not configured");
        var code="B"+id.ToString("N")[..20].ToUpperInvariant();
        await using(var write=new NpgsqlCommand("""
            INSERT INTO pricing_snapshots(id,lot_id,plan_id,vehicle_type,engine_version,resolved_rules,policy_snapshot,currency,created_at)
            VALUES(@snapshot,@lot,@plan,@type,'block-v1',@rules::jsonb,jsonb_build_object('holdMinutes',@hold,'lateArrivalMinutes',@late),'VND',now());
            INSERT INTO bookings(id,code,lot_id,vehicle_id,vehicle_type,customer_id,plate_snapshot,mode,starts_at,ends_at,hold_expires_at,
              arrival_deadline,status,pricing_snapshot_id,estimated_amount,created_at)
            VALUES(@id,@code,@lot,@vehicle,@type,@user,@plate,'EXACT_SLOT',@start,@end,@expires,@arrival,'PENDING_PAYMENT',@snapshot,@amount,now());
            INSERT INTO slot_reservations(id,booking_id,lot_id,slot_id,vehicle_type,starts_at,ends_at,status,created_at)
            VALUES(gen_random_uuid(),@id,@lot,@slot,@type,@start,@end,'HELD',now());
            INSERT INTO audit_logs(id,lot_id,actor_user_id,actor_type,action,entity_type,entity_id,created_at)
            VALUES(gen_random_uuid(),@lot,@user,'USER','CREATE_BOOKING','BOOKING',@entity,now());
            """,conn,tx))
        {
            write.Parameters.AddWithValue("snapshot",snapshot);write.Parameters.AddWithValue("lot",request.LotId);write.Parameters.AddWithValue("plan",plan);
            write.Parameters.AddWithValue("type",type);write.Parameters.AddWithValue("rules",rulesJson);write.Parameters.AddWithValue("hold",hold);write.Parameters.AddWithValue("late",late);
            write.Parameters.AddWithValue("id",id);write.Parameters.AddWithValue("code",code);write.Parameters.AddWithValue("vehicle",request.VehicleId);write.Parameters.AddWithValue("user",customerId);
            write.Parameters.AddWithValue("plate",plate);write.Parameters.AddWithValue("slot",request.SlotId);write.Parameters.AddWithValue("start",request.StartsAt.UtcDateTime);
            write.Parameters.AddWithValue("end",request.EndsAt.UtcDateTime);write.Parameters.AddWithValue("expires",expires.UtcDateTime);
            write.Parameters.AddWithValue("arrival",request.StartsAt.AddMinutes(late).UtcDateTime);write.Parameters.AddWithValue("amount",amount);write.Parameters.AddWithValue("entity",id.ToString());
            await write.ExecuteNonQueryAsync(ct);
        }
        var result=new BookingView(id,code,"PENDING_PAYMENT",amount,expires,1);
        await using(var dedupe=new NpgsqlCommand("INSERT INTO integration_inbox(event_id,event_type,payload_hash,outcome) VALUES(@id,'BookingRequest',@hash,@outcome)",conn,tx))
        {dedupe.Parameters.AddWithValue("id",requestId);dedupe.Parameters.AddWithValue("hash",fingerprint);dedupe.Parameters.AddWithValue("outcome",JsonSerializer.Serialize(result));await dedupe.ExecuteNonQueryAsync(ct);}
        await tx.CommitAsync(ct);return result;
    }

    public async Task<LotAvailabilityView> GetLotAvailabilityAsync(
        Guid lotId,
        DateTimeOffset? startTime,
        DateTimeOffset? endTime,
        string? vehicleType,
        Guid? levelId,
        CancellationToken ct)
    {
        var queryStart = startTime ?? DateTimeOffset.UtcNow;
        var queryEnd = endTime ?? queryStart.AddMinutes(60);

        if (queryEnd <= queryStart)
            throw new ServiceException(400, "EndTime must be greater than StartTime");

        // 1. Verify Parking Lot exists & get details
        await using var lotCmd = db.CreateCommand("SELECT code, name, timezone, status FROM parking_lots WHERE id = @lot");
        lotCmd.Parameters.AddWithValue("lot", lotId);
        await using var lotReader = await lotCmd.ExecuteReaderAsync(ct);
        if (!await lotReader.ReadAsync(ct))
            throw new ServiceException(404, "Parking lot not found");

        var lotCode = lotReader.GetString(0);
        var lotStatus = lotReader.GetString(3);
        if (lotStatus != "ACTIVE")
            throw new ServiceException(400, "Parking lot is inactive or closed");

        var tzName = lotReader.GetString(2);
        TimeZoneInfo tz;
        try { tz = TimeZoneInfo.FindSystemTimeZoneById(tzName); }
        catch { tz = TimeZoneInfo.Utc; }
        await lotReader.CloseAsync();

        // 2. Query all levels for this lot
        var levelsMap = new Dictionary<Guid, (string Code, string Name, int Order, List<SlotAvailabilityItem> Slots)>();
        await using var lvlCmd = db.CreateCommand("SELECT id, code, name, display_order FROM parking_levels WHERE lot_id = @lot ORDER BY display_order");
        lvlCmd.Parameters.AddWithValue("lot", lotId);
        await using var lvlReader = await lvlCmd.ExecuteReaderAsync(ct);
        while (await lvlReader.ReadAsync(ct))
        {
            var lId = lvlReader.GetGuid(0);
            levelsMap[lId] = (lvlReader.GetString(1), lvlReader.GetString(2), lvlReader.GetInt32(3), new List<SlotAvailabilityItem>());
        }
        await lvlReader.CloseAsync();

        // 3. Query slots and determine availability status
        var targetType = string.IsNullOrWhiteSpace(vehicleType) ? null : vehicleType.Trim();
        var sql = """
            SELECT 
                s.id,
                s.code,
                s.level_id,
                z.code AS zone_code,
                s.operational_status::text,
                COALESCE((
                    SELECT array_agg(vt.vehicle_type_code) 
                    FROM slot_vehicle_types vt 
                    WHERE vt.slot_id = s.id
                ), ARRAY['Car']::text[]) AS supported_types,
                COALESCE((
                    SELECT array_agg(sf.feature_code) 
                    FROM slot_feature_links fl 
                    JOIN slot_features sf ON sf.id = fl.feature_id 
                    WHERE fl.slot_id = s.id
                ), ARRAY[]::text[]) AS features,
                EXISTS(
                    SELECT 1 FROM session_slot_assignments sa 
                    WHERE sa.slot_id = s.id AND sa.vacated_at IS NULL
                ) AS is_physically_occupied,
                EXISTS(
                    SELECT 1 FROM slot_reservations sr
                    JOIN bookings b ON b.id = sr.booking_id
                    WHERE sr.slot_id = s.id 
                      AND sr.status IN ('HELD', 'CONFIRMED')
                      AND b.status IN ('PENDING_PAYMENT', 'CONFIRMED')
                      AND NOT (sr.ends_at <= @start OR sr.starts_at >= @end)
                ) AS is_reserved
            FROM parking_slots s
            LEFT JOIN zones z ON z.id = s.zone_id
            WHERE s.lot_id = @lot
              AND (@levelId IS NULL OR s.level_id = @levelId)
            ORDER BY s.code
            """;

        await using var slotCmd = db.CreateCommand(sql);
        slotCmd.Parameters.AddWithValue("lot", lotId);
        slotCmd.Parameters.AddWithValue("levelId", (object?)levelId ?? DBNull.Value);
        slotCmd.Parameters.AddWithValue("start", queryStart.UtcDateTime);
        slotCmd.Parameters.AddWithValue("end", queryEnd.UtcDateTime);

        int totalSlots = 0;
        int availableCount = 0;
        int heldCount = 0;
        int occupiedCount = 0;
        int maintenanceCount = 0;

        await using var r = await slotCmd.ExecuteReaderAsync(ct);
        while (await r.ReadAsync(ct))
        {
            var sId = r.GetGuid(0);
            var sCode = r.GetString(1);
            var sLevelId = r.GetGuid(2);
            var zCode = r.IsDBNull(3) ? "UNZONED" : r.GetString(3);
            var opStatus = r.GetString(4);
            var supportedTypes = (string[])r.GetValue(5);
            var features = (string[])r.GetValue(6);
            var isPhysicallyOccupied = r.GetBoolean(7);
            var isReserved = r.GetBoolean(8);

            // Filter vehicle type if provided
            if (targetType != null && !supportedTypes.Any(t => string.Equals(t, targetType, StringComparison.OrdinalIgnoreCase)))
                continue;

            totalSlots++;

            string finalStatus;
            if (opStatus != "ACTIVE")
            {
                finalStatus = "MAINTENANCE";
                maintenanceCount++;
            }
            else if (isPhysicallyOccupied)
            {
                finalStatus = "OCCUPIED";
                occupiedCount++;
            }
            else if (isReserved)
            {
                finalStatus = "HELD";
                heldCount++;
            }
            else
            {
                finalStatus = "AVAILABLE";
                availableCount++;
            }

            var item = new SlotAvailabilityItem(sId, sCode, zCode, supportedTypes, features, finalStatus);
            if (levelsMap.TryGetValue(sLevelId, out var levelGroup))
            {
                levelGroup.Slots.Add(item);
            }
        }

        var resultLevels = levelsMap
            .OrderBy(kv => kv.Value.Order)
            .Select(kv => new LevelAvailabilityItem(
                kv.Key,
                kv.Value.Code,
                kv.Value.Name,
                kv.Value.Slots
            ))
            .ToList();

        return new LotAvailabilityView(
            lotId,
            lotCode,
            new QueryTimeRange(queryStart, queryEnd),
            totalSlots,
            availableCount,
            heldCount,
            occupiedCount,
            maintenanceCount,
            resultLevels
        );
    }

    public async Task<BookingDetailView> GetBookingDetailAsync(
        Guid bookingId,
        Guid requestingUserId,
        CancellationToken ct)
    {
        await using var conn = await db.OpenConnectionAsync(ct);
        var sql = """
            SELECT 
                b.id,
                b.code,
                b.lot_id,
                p.name AS lot_name,
                b.customer_id,
                sr.slot_id,
                s.code AS slot_code,
                b.plate_snapshot,
                b.vehicle_type,
                b.starts_at,
                b.ends_at,
                b.hold_expires_at,
                b.arrival_deadline,
                b.status::text,
                b.estimated_amount,
                qt.token AS qr_token,
                b.created_at
            FROM bookings b
            JOIN parking_lots p ON p.id = b.lot_id
            LEFT JOIN slot_reservations sr ON sr.booking_id = b.id AND sr.status IN ('HELD', 'CONFIRMED')
            LEFT JOIN parking_slots s ON s.id = sr.slot_id
            LEFT JOIN qr_tokens qt ON qt.booking_id = b.id AND qt.status = 'ACTIVE'
            WHERE b.id = @bookingId
            """;

        await using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("bookingId", bookingId);
        await using var r = await cmd.ExecuteReaderAsync(ct);

        if (!await r.ReadAsync(ct))
            throw new ServiceException(404, "Booking not found");

        var bId = r.GetGuid(0);
        var bCode = r.GetString(1);
        var lotId = r.GetGuid(2);
        var lotName = r.GetString(3);
        var customerId = r.IsDBNull(4) ? (Guid?)null : r.GetGuid(4);
        var slotId = r.IsDBNull(5) ? (Guid?)null : r.GetGuid(5);
        var slotCode = r.IsDBNull(6) ? null : r.GetString(6);
        var plate = r.GetString(7);
        var vehicleType = r.GetString(8);
        var startsAt = new DateTimeOffset(r.GetDateTime(9), TimeSpan.Zero);
        var endsAt = new DateTimeOffset(r.GetDateTime(10), TimeSpan.Zero);
        var holdExpiresAt = r.IsDBNull(11) ? (DateTimeOffset?)null : new DateTimeOffset(r.GetDateTime(11), TimeSpan.Zero);
        var arrivalDeadline = new DateTimeOffset(r.GetDateTime(12), TimeSpan.Zero);
        var status = r.GetString(13);
        var amount = r.GetInt64(14);
        var qrToken = r.IsDBNull(15) ? null : r.GetString(15);
        var createdAt = new DateTimeOffset(r.GetDateTime(16), TimeSpan.Zero);
        await r.CloseAsync();

        // Facility-Scoped RBAC & Resource Ownership Check
        bool isOwner = customerId.HasValue && customerId.Value == requestingUserId;
        if (!isOwner)
        {
            // Check if Staff assigned to this specific lot
            await using var staffCmd = new NpgsqlCommand("""
                SELECT 1 FROM lot_staff_assignments 
                WHERE lot_id = @lot AND user_id = @user 
                  AND revoked_at IS NULL 
                  AND (valid_until IS NULL OR valid_until > now())
                """, conn);
            staffCmd.Parameters.AddWithValue("lot", lotId);
            staffCmd.Parameters.AddWithValue("user", requestingUserId);
            var isStaff = await staffCmd.ExecuteScalarAsync(ct) != null;

            if (!isStaff)
                throw new ServiceException(403, "Forbidden: Resource ownership or facility scope violation");
        }

        return new BookingDetailView(
            bId,
            bCode,
            lotId,
            lotName,
            slotId,
            slotCode,
            plate,
            vehicleType,
            startsAt,
            endsAt,
            holdExpiresAt,
            arrivalDeadline,
            status,
            amount,
            qrToken,
            createdAt
        );
    }

    public async Task<int> ExpireHoldsAsync(CancellationToken ct)
    {
        await using var conn = await db.OpenConnectionAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);

        // Core Invariants:
        // 1. Do not release slot if vehicle is physically occupying slot (session_slot_assignments.vacated_at IS NULL)
        // 2. Only release HELD reservations for PENDING_PAYMENT bookings where hold_expires_at <= now()
        var sql = """
            WITH expired_candidates AS (
                SELECT b.id AS booking_id, sr.slot_id
                FROM bookings b
                JOIN slot_reservations sr ON sr.booking_id = b.id
                WHERE b.status = 'PENDING_PAYMENT'
                  AND b.hold_expires_at <= now()
                  AND sr.status = 'HELD'
                  AND NOT EXISTS (
                      SELECT 1 FROM session_slot_assignments sa 
                      WHERE sa.slot_id = sr.slot_id AND sa.vacated_at IS NULL
                  )
            ),
            released_reservations AS (
                UPDATE slot_reservations sr
                SET status = 'RELEASED', released_at = now(), release_reason = 'HOLD_EXPIRED'
                FROM expired_candidates ec
                WHERE sr.booking_id = ec.booking_id AND sr.slot_id = ec.slot_id
                RETURNING sr.booking_id
            )
            UPDATE bookings b
            SET status = 'EXPIRED', version = version + 1
            FROM (SELECT DISTINCT booking_id FROM released_reservations) rr
            WHERE b.id = rr.booking_id;
            """;

        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        var affected = await cmd.ExecuteNonQueryAsync(ct);
        await tx.CommitAsync(ct);
        return affected;
    }
}

