using System.Text.Json;
using Npgsql;
using Parking.Parking.Domain;
using Parking.ServiceDefaults;

namespace Parking.Parking.Persistence;

public sealed record PublishPricing(string VehicleType, string Name, int ExpectedVersion, BlockPrice Rules, string Reason);
public sealed record ChangeSlotOperation(string Status, string ExpectedStatus, string Reason);

/// <summary>Persisted lot-scoped operations. Authorization is enforced by the HTTP boundary.</summary>
public sealed class OperationsRepository(NpgsqlDataSource db)
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public async Task<JsonElement> ShiftsAsync(Guid lot, CancellationToken ct)
    {
        await using var cmd = db.CreateCommand("""
            SELECT coalesce(jsonb_agg(row_to_json(x)),'[]'::jsonb)::text FROM (
              SELECT id,lot_id AS "lotId",staff_user_id AS "staffUserId",started_at AS "startedAt"
              FROM staff_shifts WHERE lot_id=@lot AND ended_at IS NULL ORDER BY started_at
            ) x
            """);
        cmd.Parameters.AddWithValue("lot",lot);
        return JsonSerializer.Deserialize<JsonElement>((string)(await cmd.ExecuteScalarAsync(ct))!);
    }

    public async Task<Guid> StartShiftAsync(Guid lot, Guid actor, CancellationToken ct)
    {
        await using var conn=await db.OpenConnectionAsync(ct); await using var tx=await conn.BeginTransactionAsync(ct);
        await using var cmd=new NpgsqlCommand("""
            INSERT INTO staff_shifts(lot_id,staff_user_id) VALUES(@lot,@actor)
            ON CONFLICT(lot_id,staff_user_id) WHERE ended_at IS NULL DO UPDATE SET staff_user_id=EXCLUDED.staff_user_id
            RETURNING id
            """,conn,tx);
        cmd.Parameters.AddWithValue("lot",lot);cmd.Parameters.AddWithValue("actor",actor);
        var id=(Guid)(await cmd.ExecuteScalarAsync(ct))!;
        await using var audit=new NpgsqlCommand("""
            INSERT INTO audit_logs(lot_id,actor_user_id,actor_type,action,entity_type,entity_id,reason)
            SELECT @lot,@actor,'USER','SHIFT_START','STAFF_SHIFT',@id,'Staff started shift'
            WHERE NOT EXISTS(SELECT 1 FROM audit_logs WHERE action='SHIFT_START' AND entity_id=@id)
            """,conn,tx);
        audit.Parameters.AddWithValue("lot",lot);audit.Parameters.AddWithValue("actor",actor);audit.Parameters.AddWithValue("id",id.ToString());
        await audit.ExecuteNonQueryAsync(ct); await tx.CommitAsync(ct); return id;
    }

    public async Task<JsonElement> PricingAsync(Guid lot, string type, CancellationToken ct)
    {
        await using var cmd = db.CreateCommand("""
            SELECT coalesce(jsonb_agg(jsonb_build_object('id',p.id,'lotId',p.lot_id,
              'vehicleType',p.vehicle_type,'version',p.version_no,'name',p.name,'status',p.status,
              'effectiveFrom',p.effective_from,'effectiveUntil',p.effective_until,
              'createdBy',p.created_by,'createdAt',p.created_at,'rules',r.parameters)
              ORDER BY p.version_no DESC),'[]'::jsonb)::text
            FROM pricing_plans p JOIN pricing_rules r ON r.plan_id=p.id AND r.rule_type='FLAT_BLOCK'
            WHERE p.lot_id=@lot AND p.vehicle_type=@type
            """);
        cmd.Parameters.AddWithValue("lot", lot); cmd.Parameters.AddWithValue("type", NormalizeType(type));
        return JsonSerializer.Deserialize<JsonElement>((string)(await cmd.ExecuteScalarAsync(ct))!);
    }

    public async Task<JsonElement> PublishAsync(Guid lot, Guid actor, PublishPricing request, CancellationToken ct)
    {
        var type = NormalizeType(request.VehicleType);
        if (string.IsNullOrWhiteSpace(request.Name) || request.Name.Length > 200 || request.ExpectedVersion < 0)
            throw new ServiceException(400, "Name and current version are required.");
        Reason(request.Reason);
        if (request.Rules is null) throw new ServiceException(400, "Pricing rules are required.");
        if (request.Rules.RateVnd <= 0 || request.Rules.DailyCapVnd <= 0)
            throw new ServiceException(400, "Published booking rates and daily caps must be positive.");
        try { request.Rules.Validate(); }
        catch (ArgumentException) { throw new ServiceException(400, "Invalid pricing rules; multiplier must be between 1 and 1.5."); }
        await using var conn = await db.OpenConnectionAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);
        await using (var gate = new NpgsqlCommand("SELECT pg_advisory_xact_lock(hashtextextended(@key,0))", conn, tx))
        { gate.Parameters.AddWithValue("key", $"pricing:{lot}:{type}"); await gate.ExecuteNonQueryAsync(ct); }
        await using (var policy = new NpgsqlCommand("SELECT EXISTS(SELECT 1 FROM lot_vehicle_policies WHERE lot_id=@lot AND vehicle_type=@type)", conn, tx))
        {
            policy.Parameters.AddWithValue("lot", lot); policy.Parameters.AddWithValue("type", type);
            if (!(bool)(await policy.ExecuteScalarAsync(ct))!) throw new ServiceException(400, "Lot does not support this vehicle type.");
        }
        int version;
        await using (var prior = new NpgsqlCommand("SELECT coalesce(max(version_no),0) FROM pricing_plans WHERE lot_id=@lot AND vehicle_type=@type", conn, tx))
        {
            prior.Parameters.AddWithValue("lot", lot); prior.Parameters.AddWithValue("type", type);
            version = (int)(await prior.ExecuteScalarAsync(ct))!;
        }
        if (version != request.ExpectedVersion) throw new ServiceException(409, "Pricing changed. Reload before publishing.");
        var id = Guid.NewGuid();
        // Existing booking/session snapshots are immutable and retain their promised price.
        await using (var write = new NpgsqlCommand("""
            UPDATE pricing_plans SET status='ARCHIVED',effective_until=greatest(now(),effective_from+interval '1 microsecond')
              WHERE lot_id=@lot AND vehicle_type=@type AND status='PUBLISHED';
            INSERT INTO pricing_plans(id,lot_id,vehicle_type,version_no,name,status,effective_from,currency,created_by)
              VALUES(@id,@lot,@type,@version,@name,'PUBLISHED',now(),'VND',@actor);
            INSERT INTO pricing_rules(plan_id,lot_id,rule_type,priority,amount,billing_unit_minutes,multiplier,parameters)
              VALUES(@id,@lot,'FLAT_BLOCK',1,@rate,@block,@multiplier,@rules::jsonb);
            INSERT INTO audit_logs(lot_id,actor_user_id,actor_type,action,entity_type,entity_id,reason,new_values)
              VALUES(@lot,@actor,'USER','PRICE_UPDATE','PRICING_PLAN',@entity,@reason,@rules::jsonb);
            """, conn, tx))
        {
            write.Parameters.AddWithValue("id", id); write.Parameters.AddWithValue("lot", lot);
            write.Parameters.AddWithValue("type", type); write.Parameters.AddWithValue("version", version + 1);
            write.Parameters.AddWithValue("name", request.Name.Trim()); write.Parameters.AddWithValue("actor", actor);
            write.Parameters.AddWithValue("rate", request.Rules.RateVnd); write.Parameters.AddWithValue("block", request.Rules.BlockMinutes);
            write.Parameters.AddWithValue("multiplier", request.Rules.Multiplier);
            write.Parameters.AddWithValue("rules", JsonSerializer.Serialize(request.Rules, Json));
            write.Parameters.AddWithValue("entity", id.ToString()); write.Parameters.AddWithValue("reason", request.Reason.Trim());
            await write.ExecuteNonQueryAsync(ct);
        }
        await tx.CommitAsync(ct);
        return await PricingAsync(lot, type, ct);
    }

    public async Task<JsonElement> SlotsAsync(Guid lot, CancellationToken ct)
    {
        await using var cmd = db.CreateCommand("""
            SELECT coalesce(jsonb_agg(row_to_json(x) ORDER BY x."levelName",x."slotCode"),'[]'::jsonb)::text FROM (
              SELECT s.id,s.lot_id AS "lotId",s.code AS "slotCode",s.level_id AS "levelId",l.name AS "levelName",
                z.id AS "zoneId",z.name AS "zoneName",s.operational_status::text AS "operationalStatus",
                CASE WHEN EXISTS(SELECT 1 FROM session_slot_assignments a WHERE a.slot_id=s.id AND a.vacated_at IS NULL) THEN 'OCCUPIED'
                  WHEN s.operational_status<>'ACTIVE' THEN s.operational_status::text
                  WHEN EXISTS(SELECT 1 FROM slot_reservations r JOIN bookings b ON b.id=r.booking_id
                    WHERE r.slot_id=s.id AND r.ends_at>now() AND r.status IN ('HELD','CONFIRMED')
                    AND (b.status='CONFIRMED' OR (b.status='PENDING_PAYMENT' AND b.hold_expires_at>now()))) THEN 'HELD'
                  ELSE 'AVAILABLE' END AS status,
                ARRAY(SELECT vehicle_type FROM slot_vehicle_types WHERE slot_id=s.id ORDER BY vehicle_type) AS "vehicleTypes"
              FROM parking_slots s JOIN parking_levels l ON l.id=s.level_id JOIN zones z ON z.id=s.zone_id
              WHERE s.lot_id=@lot
            ) x
            """);
        cmd.Parameters.AddWithValue("lot", lot);
        return JsonSerializer.Deserialize<JsonElement>((string)(await cmd.ExecuteScalarAsync(ct))!);
    }

    public async Task ChangeSlotAsync(Guid lot, Guid slot, Guid actor, ChangeSlotOperation request, CancellationToken ct)
    {
        Reason(request.Reason);
        if (request.Status is not ("ACTIVE" or "MAINTENANCE" or "DISABLED") ||
            request.ExpectedStatus is not ("ACTIVE" or "MAINTENANCE" or "DISABLED"))
            throw new ServiceException(400, "Only operational status can be changed; physical occupancy requires check-in/out.");
        await using var conn = await db.OpenConnectionAsync(ct); await using var tx = await conn.BeginTransactionAsync(ct);
        await using (var gate = new NpgsqlCommand("SELECT lock_parking_resource('SLOT',@slot)", conn, tx))
        { gate.Parameters.AddWithValue("slot", slot); await gate.ExecuteNonQueryAsync(ct); }
        await using (var read = new NpgsqlCommand("SELECT operational_status::text FROM parking_slots WHERE id=@slot AND lot_id=@lot FOR UPDATE", conn, tx))
        {
            read.Parameters.AddWithValue("slot", slot); read.Parameters.AddWithValue("lot", lot);
            var current = await read.ExecuteScalarAsync(ct) as string;
            if (current is null) throw new ServiceException(404, "Slot not found in this lot.");
            if (current != request.ExpectedStatus) throw new ServiceException(409, "Slot changed. Reload before editing.");
        }
        await using (var busy = new NpgsqlCommand("""
            SELECT EXISTS(SELECT 1 FROM session_slot_assignments WHERE slot_id=@slot AND vacated_at IS NULL)
              OR EXISTS(SELECT 1 FROM slot_reservations r JOIN bookings b ON b.id=r.booking_id
                WHERE r.slot_id=@slot AND r.ends_at>now() AND r.status IN ('HELD','CONFIRMED')
                AND (b.status='CONFIRMED' OR (b.status='PENDING_PAYMENT' AND b.hold_expires_at>now())))
            """, conn, tx))
        {
            busy.Parameters.AddWithValue("slot", slot);
            if ((bool)(await busy.ExecuteScalarAsync(ct))!)
                throw new ServiceException(409, "Slot has a vehicle or valid reservation. Resolve/reallocate it before changing operation.");
        }
        var eventId = Guid.NewGuid();
        await using (var write = new NpgsqlCommand("""
            UPDATE parking_slots SET operational_status=@status::slot_operational_status WHERE id=@slot AND lot_id=@lot;
            INSERT INTO audit_logs(lot_id,actor_user_id,actor_type,action,entity_type,entity_id,reason,old_values,new_values)
              VALUES(@lot,@actor,'USER','SLOT_OVERRIDE','PARKING_SLOT',@entity,@reason,
                jsonb_build_object('operationalStatus',@old::text),jsonb_build_object('operationalStatus',@status::text));
            INSERT INTO integration_outbox(event_id,event_type,aggregate_id,payload)
              VALUES(@event,'SlotStatusChanged.v1',@slot,jsonb_build_object('eventId',@event,'parkingLotId',@lot,'slotId',@slot,
                'status',CASE WHEN @status='ACTIVE' THEN 'AVAILABLE' ELSE @status END,'observedAt',now()));
            """, conn, tx))
        {
            write.Parameters.AddWithValue("slot", slot); write.Parameters.AddWithValue("lot", lot);
            write.Parameters.AddWithValue("actor", actor); write.Parameters.AddWithValue("entity", slot.ToString());
            write.Parameters.AddWithValue("reason", request.Reason.Trim()); write.Parameters.AddWithValue("old", request.ExpectedStatus);
            write.Parameters.AddWithValue("status", request.Status); write.Parameters.AddWithValue("event", eventId);
            await write.ExecuteNonQueryAsync(ct);
        }
        await tx.CommitAsync(ct);
    }

    public async Task<JsonElement> AuditAsync(Guid lot, DateTimeOffset from, DateTimeOffset until, CancellationToken ct)
    {
        Range(from, until);
        await using var cmd = db.CreateCommand("""
            SELECT coalesce(jsonb_agg(row_to_json(x)),'[]'::jsonb)::text FROM (
              SELECT id,created_at AS "timestampUtc",actor_user_id AS "operatorId",actor_type AS "operatorRole",
                action AS "actionType",entity_type||':'||entity_id AS "targetEntity",reason AS "justificationNote"
              FROM audit_logs WHERE lot_id=@lot AND created_at>=@from AND created_at<@until
              ORDER BY created_at DESC,id DESC LIMIT 1000
            ) x
            """);
        cmd.Parameters.AddWithValue("lot", lot); cmd.Parameters.AddWithValue("from",from.ToUniversalTime()); cmd.Parameters.AddWithValue("until",until.ToUniversalTime());
        return JsonSerializer.Deserialize<JsonElement>((string)(await cmd.ExecuteScalarAsync(ct))!);
    }

    public async Task<JsonElement> UsageAsync(Guid lot, DateTimeOffset from, DateTimeOffset until, CancellationToken ct)
    {
        Range(from, until);
        await using var cmd = db.CreateCommand("""
            SELECT jsonb_build_object(
              'lotId',@lot,'from',@from,'until',@until,
              'capacity',(SELECT count(*) FROM parking_slots WHERE lot_id=@lot AND operational_status='ACTIVE'),
              'occupied',(SELECT count(*) FROM session_slot_assignments WHERE lot_id=@lot AND vacated_at IS NULL),
              'entries',count(*) FILTER(WHERE entry_at>=@from AND entry_at<@until),
              'exits',count(*) FILTER(WHERE exit_at>=@from AND exit_at<@until),
              'averageDurationMinutes',coalesce(avg(extract(epoch FROM (exit_at-entry_at))/60)
                FILTER(WHERE exit_at>=@from AND exit_at<@until),0),
              'carEntries',count(*) FILTER(WHERE vehicle_type='CAR' AND entry_at>=@from AND entry_at<@until),
              'motorbikeEntries',count(*) FILTER(WHERE vehicle_type='MOTORBIKE' AND entry_at>=@from AND entry_at<@until)
            )::text FROM parking_sessions WHERE lot_id=@lot
            """);
        cmd.Parameters.AddWithValue("lot", lot); cmd.Parameters.AddWithValue("from",from.ToUniversalTime()); cmd.Parameters.AddWithValue("until",until.ToUniversalTime());
        return JsonSerializer.Deserialize<JsonElement>((string)(await cmd.ExecuteScalarAsync(ct))!);
    }

    public static void Range(DateTimeOffset from, DateTimeOffset until)
    { if (until <= from || until - from > TimeSpan.FromDays(366)) throw new ServiceException(400, "Select a range of at most 366 days."); }
    private static void Reason(string reason)
    { if (string.IsNullOrWhiteSpace(reason) || reason.Length > 2000) throw new ServiceException(400, "An audit reason of 1-2000 characters is required."); }
    private static string NormalizeType(string type) => type?.ToUpperInvariant() switch
    { "CAR" => "CAR", "MOTORBIKE" or "MOTORCYCLE" => "MOTORBIKE", _ => throw new ServiceException(400, "Vehicle type must be CAR or MOTORBIKE.") };
}
