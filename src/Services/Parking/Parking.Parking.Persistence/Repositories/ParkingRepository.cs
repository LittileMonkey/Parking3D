using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Npgsql;
using Parking.Parking.Application;
using Parking.Parking.Application.DTOs;
using Parking.Parking.Domain;
using Parking.ServiceDefaults;

namespace Parking.Parking.Persistence.Repositories;

public sealed partial class ParkingRepository(NpgsqlDataSource db, TimeProvider clock) : IParkingRepository
{
    /// <summary>Liệt kê bãi ACTIVE theo mã bãi; chỉ trả dữ liệu công khai phục vụ chọn bãi.</summary>
    public async Task<IReadOnlyList<LotView>> ListLotsAsync(CancellationToken ct)
    {
        await using var cmd = db.CreateCommand("SELECT id,code,name,address,latitude,longitude,timezone FROM parking_lots WHERE status='ACTIVE' ORDER BY code");
        await using var r = await cmd.ExecuteReaderAsync(ct);
        var items = new List<LotView>();
        while (await r.ReadAsync(ct)) items.Add(new LotView(r.GetGuid(0), r.GetString(1), r.GetString(2), r.GetString(3), (double)r.GetDecimal(4), (double)r.GetDecimal(5), r.GetString(6)));
        return items;
    }
    /// <summary>Kiểm tra bãi tồn tại và đang ACTIVE bằng truy vấn EXISTS.</summary>
    public async Task<bool> LotExistsAsync(Guid lotId, CancellationToken ct)
    {
        await using var cmd = db.CreateCommand("SELECT EXISTS(SELECT 1 FROM parking_lots WHERE id=@lot AND status='ACTIVE')");
        cmd.Parameters.AddWithValue("lot", lotId);
        return (bool)(await cmd.ExecuteScalarAsync(ct))!;
    }

    /// <summary>Tạo booking PENDING_PAYMENT và reservation HELD theo policy trong transaction chống đặt trùng; dọn hold hết hạn liên quan trước khi đặt.</summary>
    public async Task<BookingView> CreateBookingAsync(Guid customerId, BookingRequest request, string key, CancellationToken ct)
    {
        if (request.LotId == Guid.Empty || (request.Mode == "EXACT_SLOT" && request.SlotId == Guid.Empty) || request.VehicleId == Guid.Empty || (request.EndsAt-request.StartsAt).TotalMinutes < 30 || (request.EndsAt-request.StartsAt).TotalMinutes > 1440
            || request.StartsAt < clock.GetUtcNow().AddMinutes(-5) || string.IsNullOrWhiteSpace(key) || key.Length > 128)
            throw new ServiceException(400, "Valid IDs, future time range and Idempotency-Key required");
        if (request.Mode is not ("EXACT_SLOT" or "AUTO_SLOT")) throw new ServiceException(400, "Mode must be EXACT_SLOT or AUTO_SLOT");
        await ExpireHoldsAsync(ct, request.Mode == "AUTO_SLOT" ? null : request.VehicleId, request.Mode == "AUTO_SLOT" ? null : request.SlotId);
        await using var conn = await db.OpenConnectionAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);
        // Khóa request theo khách trước khi ghi; retry cùng key không tạo booking thứ hai.
        var requestId = new Guid(SHA256.HashData(Encoding.UTF8.GetBytes(customerId + ":" + key)).AsSpan(0, 16));
        var fingerprint = Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(request))));
        await using (var cmd = new NpgsqlCommand("SELECT pg_advisory_xact_lock(hashtext(@key)); SELECT lock_parking_resource('VEHICLE',@vehicle);", conn, tx))
        { cmd.Parameters.AddWithValue("key", customerId + ":" + key); cmd.Parameters.AddWithValue("vehicle", request.VehicleId); await cmd.ExecuteNonQueryAsync(ct); }
        await using (var old = new NpgsqlCommand("SELECT payload_hash,outcome FROM integration_inbox WHERE event_id=@id AND event_type='BookingRequest'", conn, tx))
        {
            old.Parameters.AddWithValue("id", requestId); await using var r = await old.ExecuteReaderAsync(ct);
            if (await r.ReadAsync(ct))
            {
                if (r.GetString(0) != fingerprint) throw new ServiceException(409, "Idempotency key reused for another request");
                return JsonSerializer.Deserialize<BookingView>(r.GetString(1))!;
            }
        }
        string type;
        string plate;
        await using (var vehicle = new NpgsqlCommand("""
            SELECT v.vehicle_type,v.plate_normalized FROM vehicles v JOIN user_vehicle_access a ON a.vehicle_id=v.id
            WHERE v.id=@vehicle AND v.is_active AND a.user_id=@user AND a.verified_at IS NOT NULL AND a.revoked_at IS NULL
            """, conn, tx))
        {
            vehicle.Parameters.AddWithValue("vehicle", request.VehicleId); vehicle.Parameters.AddWithValue("user", customerId);
            await using var r = await vehicle.ExecuteReaderAsync(ct); if (!await r.ReadAsync(ct)) throw new ServiceException(403, "Verified vehicle access required");
            type = r.GetString(0); plate = r.GetString(1);
        }
        var slotId = request.SlotId;
        if (request.Mode == "AUTO_SLOT")
        {
            var candidates = new List<Guid>();
            await using (var choose = new NpgsqlCommand("""
                SELECT s.id FROM parking_slots s
                JOIN slot_vehicle_types t ON t.slot_id=s.id AND t.vehicle_type=@type
                WHERE s.lot_id=@lot AND s.operational_status='ACTIVE'
                  AND NOT EXISTS(SELECT 1 FROM slot_feature_links f WHERE f.slot_id=s.id AND f.feature_code IN ('ACCESSIBLE','PRIORITY','EV','EV_CHARGING'))
                ORDER BY s.id
                """, conn, tx))
            {
                choose.Parameters.AddWithValue("lot",request.LotId); choose.Parameters.AddWithValue("type",type);
                await using var reader=await choose.ExecuteReaderAsync(ct);
                while(await reader.ReadAsync(ct)) candidates.Add(reader.GetGuid(0));
            }
            slotId=Guid.Empty;
            foreach(var candidate in candidates)
            {
                // Same lock order as exact booking: vehicle, then slots in UUID order.
                await using var take=new NpgsqlCommand("SELECT lock_parking_resource('SLOT',@slot)",conn,tx);
                take.Parameters.AddWithValue("slot",candidate); await take.ExecuteNonQueryAsync(ct);
                await using var free=new NpgsqlCommand("""
                    SELECT EXISTS(SELECT 1 FROM parking_slots s WHERE s.id=@slot AND s.operational_status='ACTIVE'
                      AND NOT EXISTS(SELECT 1 FROM session_slot_assignments a WHERE a.slot_id=s.id AND a.vacated_at IS NULL)
                      AND NOT EXISTS(SELECT 1 FROM slot_reservations r WHERE r.slot_id=s.id AND r.status IN ('HELD','CONFIRMED')
                        AND tstzrange(r.starts_at,r.ends_at,'[)') && tstzrange(@start,@end,'[)')))
                    """,conn,tx);
                free.Parameters.AddWithValue("slot",candidate);free.Parameters.AddWithValue("start",request.StartsAt.UtcDateTime);free.Parameters.AddWithValue("end",request.EndsAt.UtcDateTime);
                if((bool)(await free.ExecuteScalarAsync(ct))!) { slotId=candidate;break; }
            }
            if(slotId==Guid.Empty)throw new ServiceException(409,"No compatible slot remains in this time range");
        }
        else
        {
            await using var take=new NpgsqlCommand("SELECT lock_parking_resource('SLOT',@slot)",conn,tx);
            take.Parameters.AddWithValue("slot",slotId);await take.ExecuteNonQueryAsync(ct);
        }
        string timezone;
        int hold;
        int late;
        int cancellationCutoff;
        int configuredGrace;
        Guid plan;
        string rulesJson;
        BlockPrice price;
        await using (var policy = new NpgsqlCommand("""
            SELECT l.timezone,p.hold_minutes,p.min_booking_minutes,p.max_booking_minutes,p.late_arrival_minutes,
              pp.id,pr.parameters::text,p.cancellation_refund_cutoff_minutes,p.grace_free_minutes FROM parking_lots l JOIN lot_vehicle_policies p ON p.lot_id=l.id
              JOIN parking_slots s ON s.lot_id=l.id AND s.id=@slot
              JOIN slot_vehicle_types sv ON sv.slot_id=s.id AND sv.vehicle_type=p.vehicle_type
              JOIN pricing_plans pp ON pp.lot_id=l.id AND pp.vehicle_type=p.vehicle_type
              JOIN pricing_rules pr ON pr.plan_id=pp.id AND pr.rule_type='FLAT_BLOCK'
            WHERE l.id=@lot AND l.status='ACTIVE' AND p.vehicle_type=@type AND s.operational_status='ACTIVE'
              AND pp.status='PUBLISHED' AND pp.currency='VND' AND pp.effective_from<=@start
              AND (pp.effective_until IS NULL OR pp.effective_until>=@end)
              AND NOT EXISTS(SELECT 1 FROM session_slot_assignments x WHERE x.slot_id=s.id AND x.vacated_at IS NULL)
              AND NOT EXISTS(SELECT 1 FROM slot_feature_links f WHERE f.slot_id=s.id AND f.feature_code IN ('ACCESSIBLE','PRIORITY','EV','EV_CHARGING'))
              AND NOT EXISTS(SELECT 1 FROM pricing_rules extra WHERE extra.plan_id=pp.id AND extra.id<>pr.id)
            ORDER BY pp.version_no DESC LIMIT 1
            """, conn, tx))
        {
            policy.Parameters.AddWithValue("slot", slotId); policy.Parameters.AddWithValue("lot", request.LotId); policy.Parameters.AddWithValue("type", type);
            policy.Parameters.AddWithValue("start", request.StartsAt.UtcDateTime); policy.Parameters.AddWithValue("end", request.EndsAt.UtcDateTime);
            await using var r = await policy.ExecuteReaderAsync(ct); if (!await r.ReadAsync(ct)) throw new ServiceException(409, "Lot/slot/price unavailable or unsupported pricing rules");
            cancellationCutoff = r.GetInt32(7);
            configuredGrace = r.GetInt32(8);
            timezone = r.GetString(0); hold = r.GetInt32(1); late = r.GetInt32(4); plan = r.GetGuid(5); rulesJson = r.GetString(6);
            var minutes = (request.EndsAt - request.StartsAt).TotalMinutes;
            if (minutes < r.GetInt32(2) || minutes > r.GetInt32(3)) throw new ServiceException(400, "Booking duration outside configured policy");
            price = JsonSerializer.Deserialize<BlockPrice>(rulesJson, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? throw new ServiceException(409, "Invalid pricing configuration");
        }
        var tz = TimeZoneInfo.FindSystemTimeZoneById(timezone); price.Validate();
        // Toàn bộ khoảng đỗ phải nằm trong lịch mở cửa theo múi giờ của bãi.
        await using (var closure = new NpgsqlCommand("SELECT EXISTS(SELECT 1 FROM lot_closures WHERE lot_id=@lot AND tstzrange(starts_at,ends_at,'[)') && tstzrange(@start,@end,'[)'))", conn, tx))
        {
            closure.Parameters.AddWithValue("lot", request.LotId); closure.Parameters.AddWithValue("start", request.StartsAt.UtcDateTime); closure.Parameters.AddWithValue("end", request.EndsAt.UtcDateTime);
            if ((bool)(await closure.ExecuteScalarAsync(ct))!) throw new ServiceException(409, "Lot closed during requested interval");
        }
        var intervals = new List<(int From, int To)>();
        await using (var opening = new NpgsqlCommand("SELECT start_minute,end_minute FROM lot_opening_intervals WHERE lot_id=@lot", conn, tx))
        { opening.Parameters.AddWithValue("lot", request.LotId); await using var r = await opening.ExecuteReaderAsync(ct); while (await r.ReadAsync(ct)) intervals.Add((r.GetInt32(0), r.GetInt32(1))); }
        for (var at = request.StartsAt; at < request.EndsAt; at = at.AddTicks(TimeSpan.TicksPerMinute - at.UtcTicks % TimeSpan.TicksPerMinute))
        {
            var local = TimeZoneInfo.ConvertTime(at, tz); var minute = (((int)local.DayOfWeek + 6) % 7) * 1440 + local.Hour * 60 + local.Minute;
            if (!intervals.Any(i => minute >= i.From && minute < i.To)) throw new ServiceException(409, "Outside lot operating hours");
        }
        var id=Guid.NewGuid();var grace=0;
        if(configuredGrace>0)
        {
            await using var grant=new NpgsqlCommand("INSERT INTO daily_grace_claims(user_id,local_day,booking_id,minutes) VALUES(@user,(@start AT TIME ZONE 'Asia/Ho_Chi_Minh')::date,@id,@minutes) ON CONFLICT DO NOTHING RETURNING minutes",conn,tx);
            grant.Parameters.AddWithValue("user",customerId);grant.Parameters.AddWithValue("start",request.StartsAt.UtcDateTime);grant.Parameters.AddWithValue("id",id);grant.Parameters.AddWithValue("minutes",configuredGrace);
            if(await grant.ExecuteScalarAsync(ct) is int minutes)grace=minutes;
        }
        var snapshot=Guid.NewGuid();var amount=price.Estimate(request.StartsAt.AddMinutes(grace),request.EndsAt,tz);var expires=clock.GetUtcNow().AddMinutes(hold);
        if (amount <= 0) throw new ServiceException(409, "Zero-price booking workflow not configured");
        var code = "B" + id.ToString("N")[..20].ToUpperInvariant();
        await using (var write = new NpgsqlCommand("""
            INSERT INTO pricing_snapshots(id,lot_id,plan_id,vehicle_type,engine_version,resolved_rules,policy_snapshot,currency,created_at)
            VALUES(@snapshot,@lot,@plan,@type,'block-v1',@rules::jsonb,jsonb_build_object('holdMinutes',@hold,'lateArrivalMinutes',@late,'cancellationRefundCutoffMinutes',@cutoff,'graceFreeMinutes',@grace),'VND',now());
            INSERT INTO bookings(id,code,lot_id,vehicle_id,vehicle_type,customer_id,plate_snapshot,mode,starts_at,ends_at,hold_expires_at,
              arrival_deadline,status,pricing_snapshot_id,estimated_amount,created_at)
            VALUES(@id,@code,@lot,@vehicle,@type,@user,@plate,@mode::booking_mode,@start,@end,@expires,@arrival,'PENDING_PAYMENT',@snapshot,@amount,now());
            INSERT INTO slot_reservations(id,booking_id,lot_id,slot_id,vehicle_type,starts_at,ends_at,status,created_at)
            VALUES(gen_random_uuid(),@id,@lot,@slot,@type,@start,@end,'HELD',now());
            INSERT INTO audit_logs(id,lot_id,actor_user_id,actor_type,action,entity_type,entity_id,created_at)
            VALUES(gen_random_uuid(),@lot,@user,'USER','CREATE_BOOKING','BOOKING',@entity,now());
            """, conn, tx))
        {
            write.Parameters.AddWithValue("cutoff", cancellationCutoff);
            write.Parameters.AddWithValue("grace",grace);
            write.Parameters.AddWithValue("snapshot", snapshot); write.Parameters.AddWithValue("lot", request.LotId); write.Parameters.AddWithValue("plan", plan);
            write.Parameters.AddWithValue("type", type); write.Parameters.AddWithValue("rules", rulesJson); write.Parameters.AddWithValue("hold", hold); write.Parameters.AddWithValue("late", late);
            write.Parameters.AddWithValue("id", id); write.Parameters.AddWithValue("code", code); write.Parameters.AddWithValue("vehicle", request.VehicleId); write.Parameters.AddWithValue("user", customerId);
            write.Parameters.AddWithValue("mode",request.Mode);
            write.Parameters.AddWithValue("plate", plate); write.Parameters.AddWithValue("slot", slotId); write.Parameters.AddWithValue("start", request.StartsAt.UtcDateTime);
            write.Parameters.AddWithValue("end", request.EndsAt.UtcDateTime); write.Parameters.AddWithValue("expires", expires.UtcDateTime);
            write.Parameters.AddWithValue("arrival", request.StartsAt.AddMinutes(late).UtcDateTime); write.Parameters.AddWithValue("amount", amount); write.Parameters.AddWithValue("entity", id.ToString());
            await write.ExecuteNonQueryAsync(ct);
        }
        var result = new BookingView(id, code, "PENDING_PAYMENT", amount, expires, 1);
        await using (var dedupe = new NpgsqlCommand("INSERT INTO integration_inbox(event_id,event_type,payload_hash,outcome) VALUES(@id,'BookingRequest',@hash,@outcome)", conn, tx))
        { dedupe.Parameters.AddWithValue("id", requestId); dedupe.Parameters.AddWithValue("hash", fingerprint); dedupe.Parameters.AddWithValue("outcome", JsonSerializer.Serialize(result)); await dedupe.ExecuteNonQueryAsync(ct); }
        await tx.CommitAsync(ct);
        return result;
    }

}
