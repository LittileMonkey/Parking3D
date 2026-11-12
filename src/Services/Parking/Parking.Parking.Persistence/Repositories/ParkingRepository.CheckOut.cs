using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Npgsql;
using NpgsqlTypes;
using Parking.Parking.Application;
using Parking.Parking.Application.DTOs;
using Parking.Parking.Domain;
using Parking.ServiceDefaults;

namespace Parking.Parking.Persistence.Repositories;

public sealed partial class ParkingRepository
{
    public async Task<Guid?> GetSessionLotIdAsync(Guid sessionId, CancellationToken ct)
    {
        await using var command = db.CreateCommand("SELECT lot_id FROM parking_sessions WHERE id=@session");
        command.Parameters.AddWithValue("session", sessionId);
        return await command.ExecuteScalarAsync(ct) is Guid lot ? lot : null;
    }

    public async Task<CheckOutQuoteResultDto> GetCheckOutQuoteAsync(Guid lotId, Guid gateId,
        string detectedPlate, string? qrPayload, CancellationToken ct, Guid? sessionId = null)
    {
        if (lotId == Guid.Empty || gateId == Guid.Empty) throw new ServiceException(400, "Valid lot and gate required.");
        if (!string.IsNullOrWhiteSpace(qrPayload)) throw new ServiceException(400, "Exit QR must be verified before lookup.");
        var hasPlate = PlateNumber.TryNormalize(detectedPlate ?? "", out var plate);
        if (!hasPlate && sessionId is null) throw new ServiceException(400, "Valid plate or verified exit QR required.");
        await using var connection = await db.OpenConnectionAsync(ct);
        await using (var gate = new NpgsqlCommand("SELECT EXISTS(SELECT 1 FROM lot_gates WHERE id=@gate AND lot_id=@lot AND gate_kind IN ('EXIT','BOTH'))", connection))
        {
            gate.Parameters.AddWithValue("gate", gateId); gate.Parameters.AddWithValue("lot", lotId);
            if (!(bool)(await gate.ExecuteScalarAsync(ct))!) throw new ServiceException(400, "Invalid exit gate for this lot.");
        }
        await using var command = new NpgsqlCommand("""
            SELECT ps.id,ps.booking_id,s.id,s.code,ps.plate_snapshot,ps.entry_at,ps.expected_exit_at,
                l.timezone,sn.resolved_rules,
                (SELECT coalesce(sum(amount),0) FROM payment_receipts WHERE booking_id=ps.booking_id),
                ps.pricing_snapshot_id,ps.vehicle_id,b.starts_at
            FROM parking_sessions ps
            JOIN session_slot_assignments a ON a.session_id=ps.id AND a.vacated_at IS NULL
            JOIN parking_slots s ON s.id=a.slot_id AND s.lot_id=ps.lot_id
            JOIN parking_lots l ON l.id=ps.lot_id
            JOIN pricing_snapshots sn ON sn.id=ps.pricing_snapshot_id
            LEFT JOIN bookings b ON b.id=ps.booking_id
            WHERE ps.lot_id=@lot AND ps.status='ACTIVE'
                AND ((@session IS NOT NULL AND ps.id=@session) OR (@session IS NULL AND ps.plate_snapshot=@plate))
            """, connection);
        command.Parameters.AddWithValue("lot", lotId);
        command.Parameters.Add("session", NpgsqlDbType.Uuid).Value = (object?)sessionId ?? DBNull.Value;
        command.Parameters.AddWithValue("plate", plate);
        await using var reader = await command.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) throw new ServiceException(404, "Active parking session not found at this lot.");
        var now = clock.GetUtcNow();
        var booking = reader.IsDBNull(1) ? (Guid?)null : reader.GetGuid(1);
        var entry = reader.GetFieldValue<DateTimeOffset>(5);
        var expected = reader.GetFieldValue<DateTimeOffset>(6);
        var entryPlate = reader.GetString(4);
        var matches = hasPlate && PlateNumber.TryNormalize(entryPlate, out var original) && original == plate;
        var due = CalculateCheckOutFee(booking.HasValue, entry, expected, now, reader.GetString(8), reader.GetString(7),
            reader.IsDBNull(12)?null:reader.GetFieldValue<DateTimeOffset>(12));
        return new(reader.GetGuid(0), booking, reader.GetGuid(2), reader.GetString(3), entryPlate,
            hasPlate ? plate : "", matches, entry, expected, now,
            (int)Math.Max(0, Math.Ceiling((now-entry).TotalMinutes)),
            (int)Math.Max(0, Math.Ceiling((now-expected).TotalMinutes)),
            reader.GetDecimal(9), due, due, due > 0,
            matches ? null : hasPlate ? "INCIDENT_0482_PLATE_MISMATCH" : "PLATE_OBSERVATION_REQUIRED",
            PricingSnapshotId: reader.GetGuid(10), VehicleId: reader.GetGuid(11));
    }

    private static decimal CalculateCheckOutFee(bool hasBooking, DateTimeOffset entry, DateTimeOffset expected,
        DateTimeOffset at, string rules, string timezone, DateTimeOffset? bookedStart=null, bool isGoldStarMember=false)
    {
        try { return CheckOutFee.Calculate(hasBooking,entry,expected,at,rules,timezone,bookedStart,isGoldStarMember); }
        catch (Exception error) when (error is ArgumentException or JsonException or TimeZoneNotFoundException or InvalidTimeZoneException)
        { throw new ServiceException(503,"Pricing snapshot unavailable. Checkout is blocked."); }
    }

    public async Task RecordCheckOutMismatchAsync(Guid sessionId, Guid actorId, string observedPlate, CancellationToken ct)
    {
        await using var command = db.CreateCommand("""
            INSERT INTO audit_logs(lot_id,actor_user_id,actor_type,action,entity_type,entity_id,reason,new_values)
            SELECT lot_id,@actor,'STAFF','CHECK_OUT_PLATE_MISMATCH','PARKING_SESSION',id::text,
                'INCIDENT_0482_PLATE_MISMATCH',jsonb_build_object('observedPlate',@plate)
            FROM parking_sessions WHERE id=@session;
            """);
        command.Parameters.AddWithValue("session", sessionId); command.Parameters.AddWithValue("actor", actorId);
        command.Parameters.AddWithValue("plate", observedPlate);
        await command.ExecuteNonQueryAsync(ct);
    }

    private static string ValidateIdempotencyKey(string key)
    {
        if (string.IsNullOrWhiteSpace(key) || key.Trim().Length > 128)
            throw new ServiceException(400, "Valid Idempotency-Key required.");
        return key.Trim();
    }

    private static string CheckOutFingerprint(ConfirmCheckOutRequestDto request)
        => Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(request))));
    private static Guid CheckOutRequestId(Guid actor, string key)
        => new(SHA256.HashData(Encoding.UTF8.GetBytes($"CheckOut:{actor}:{key.Trim()}")).AsSpan(0,16));

    private static Guid AuthorizationRequestId(Guid actor,string key)
        =>new(SHA256.HashData(Encoding.UTF8.GetBytes($"AuthorizeExit:{actor}:{key.Trim()}")).AsSpan(0,16));

    public async Task<AuthorizeCheckOutResultDto?> GetCheckOutAuthorizationReplayAsync(Guid actorId,
        ConfirmCheckOutRequestDto request, string key, CancellationToken ct)
    {
        var normalizedKey = ValidateIdempotencyKey(key);
        var id = AuthorizationRequestId(actorId, normalizedKey);
        var fingerprint = CheckOutFingerprint(request);
        await using var read = db.CreateCommand("""
            SELECT event_type, payload_hash, outcome,
                   (received_at <= clock_timestamp() - interval '2 minutes') AS is_stale
            FROM integration_inbox
            WHERE event_id = @id;
            """);
        read.Parameters.AddWithValue("id", id);
        await using var reader = await read.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return null;
        if (reader.GetString(0) != "CheckOutAuthorization" || reader.GetString(1) != fingerprint)
            throw new ServiceException(409, "Authorization key reused for another request.");
        var outcome = reader.GetString(2);
        if (outcome == "PENDING")
        {
            if (!reader.GetBoolean(3))
                throw new ServiceException(409, "Checkout authorization with this Idempotency-Key is already in progress.");
            return null;
        }
        return JsonSerializer.Deserialize<AuthorizeCheckOutResultDto>(outcome)!;
    }

    public async Task<AuthorizeCheckOutResultDto?> ClaimCheckOutAuthorizationAsync(Guid actorId,
        ConfirmCheckOutRequestDto request,string key,CancellationToken ct)
    {
        var normalizedKey = ValidateIdempotencyKey(key);
        var id = AuthorizationRequestId(actorId, normalizedKey);
        var fingerprint = CheckOutFingerprint(request);
        await using var connection = await db.OpenConnectionAsync(ct);
        await using var tx = await connection.BeginTransactionAsync(ct);
        await using (var lockCmd = new NpgsqlCommand("SELECT pg_advisory_xact_lock(hashtextextended(@lockKey,0))", connection, tx))
        {
            lockCmd.Parameters.AddWithValue("lockKey", $"AuthorizeExit:{actorId}:{normalizedKey}");
            await lockCmd.ExecuteNonQueryAsync(ct);
        }

        string? existingType = null;
        string? existingHash = null;
        string? existingOutcome = null;
        bool isStale = false;
        await using (var read = new NpgsqlCommand("""
            SELECT event_type, payload_hash, outcome,
                   (received_at <= clock_timestamp() - interval '2 minutes') AS is_stale
            FROM integration_inbox
            WHERE event_id = @id
            FOR UPDATE;
            """, connection, tx))
        {
            read.Parameters.AddWithValue("id", id);
            await using var reader = await read.ExecuteReaderAsync(ct);
            if (await reader.ReadAsync(ct))
            {
                existingType = reader.GetString(0);
                existingHash = reader.GetString(1);
                existingOutcome = reader.GetString(2);
                isStale = reader.GetBoolean(3);
            }
        }

        if (existingOutcome is null)
        {
            await using var insert = new NpgsqlCommand("""
                INSERT INTO integration_inbox(event_id, event_type, payload_hash, received_at, outcome)
                VALUES(@id, 'CheckOutAuthorization', @hash, clock_timestamp(), 'PENDING');
                """, connection, tx);
            insert.Parameters.AddWithValue("id", id);
            insert.Parameters.AddWithValue("hash", fingerprint);
            await insert.ExecuteNonQueryAsync(ct);
            await tx.CommitAsync(ct);
            return null;
        }

        if (existingType != "CheckOutAuthorization" || existingHash != fingerprint)
            throw new ServiceException(409, "Authorization key reused for another request.");

        if (existingOutcome != "PENDING")
        {
            await tx.CommitAsync(ct);
            return JsonSerializer.Deserialize<AuthorizeCheckOutResultDto>(existingOutcome)!;
        }

        if (!isStale)
            throw new ServiceException(409, "Checkout authorization with this Idempotency-Key is already in progress.");

        await using (var refresh = new NpgsqlCommand("UPDATE integration_inbox SET received_at = clock_timestamp() WHERE event_id = @id;", connection, tx))
        {
            refresh.Parameters.AddWithValue("id", id);
            await refresh.ExecuteNonQueryAsync(ct);
        }
        await tx.CommitAsync(ct);
        return null;
    }

    public async Task ReleaseCheckOutAuthorizationClaimAsync(Guid actorId, string key, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(key)) return;
        var id = AuthorizationRequestId(actorId, key);
        await using var cmd = db.CreateCommand("""
            DELETE FROM integration_inbox
            WHERE event_id = @id AND event_type = 'CheckOutAuthorization' AND outcome = 'PENDING';
            """);
        cmd.Parameters.AddWithValue("id", id);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    public async Task<AuthorizeCheckOutResultDto> SaveCheckOutAuthorizationAsync(Guid actorId,
        ConfirmCheckOutRequestDto request,string key,AuthorizeCheckOutResultDto result,CancellationToken ct)
    {
        var normalizedKey = ValidateIdempotencyKey(key);
        var id=AuthorizationRequestId(actorId,normalizedKey);
        await using var connection=await db.OpenConnectionAsync(ct);await using var tx=await connection.BeginTransactionAsync(ct);
        await using(var prior=new NpgsqlCommand("SELECT payload_hash,outcome FROM integration_inbox WHERE event_id=@id AND event_type='CheckOutAuthorization' FOR UPDATE",connection,tx))
        {
            prior.Parameters.AddWithValue("id",id);await using var reader=await prior.ExecuteReaderAsync(ct);
            if(!await reader.ReadAsync(ct)||reader.GetString(0)!=CheckOutFingerprint(request))throw new ServiceException(409,"Authorization claim changed.");
            if(reader.GetString(1)!="PENDING")return JsonSerializer.Deserialize<AuthorizeCheckOutResultDto>(reader.GetString(1))!;
        }
        await using var write=new NpgsqlCommand("""
            UPDATE integration_inbox SET outcome=@outcome WHERE event_id=@id;
            INSERT INTO audit_logs(lot_id,actor_user_id,actor_type,action,entity_type,entity_id,request_id,new_values)
            SELECT lot_id,@actor,'STAFF','AUTHORIZE_CHECK_OUT','PARKING_SESSION',id::text,@request,
                jsonb_build_object('gateId',@gate,'amountPaid',@paid,'mode','MANUAL_OPEN_AUTHORIZED')
            FROM parking_sessions WHERE id=@session;
            """,connection,tx);
        write.Parameters.AddWithValue("id",id);write.Parameters.AddWithValue("outcome",JsonSerializer.Serialize(result));
        write.Parameters.AddWithValue("actor",actorId);write.Parameters.AddWithValue("request",id.ToString());
        write.Parameters.AddWithValue("gate",request.GateId);write.Parameters.AddWithValue("paid",result.AmountPaid);
        write.Parameters.AddWithValue("session",request.SessionId);
        await write.ExecuteNonQueryAsync(ct);await tx.CommitAsync(ct);return result;
    }

    public async Task<ConfirmCheckOutResultDto?> GetCheckOutReplayAsync(Guid actorId,
        ConfirmCheckOutRequestDto request, string key, CancellationToken ct)
    {
        await using var command = db.CreateCommand("SELECT payload_hash,outcome FROM integration_inbox WHERE event_id=@id AND event_type='CheckOutRequest'");
        command.Parameters.AddWithValue("id", CheckOutRequestId(actorId,key));
        await using var reader = await command.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return null;
        if (reader.GetString(0) != CheckOutFingerprint(request)) throw new ServiceException(409, "Idempotency key reused for another checkout.");
        return JsonSerializer.Deserialize<ConfirmCheckOutResultDto>(reader.GetString(1))!;
    }

    public async Task<ConfirmCheckOutResultDto> CompleteCheckOutAsync(Guid actorId,
        ConfirmCheckOutRequestDto request, string key, CancellationToken ct, CheckOutVerification? verification = null)
    {
        if (actorId == Guid.Empty || request.SessionId == Guid.Empty || request.GateId == Guid.Empty ||
            string.IsNullOrWhiteSpace(key) || key.Length > 128 || !request.StaffObservedExit ||
            !PlateNumber.TryNormalize(request.DetectedPlate, out var observed))
            throw new ServiceException(400,"Valid checkout identification and physical-exit confirmation required.");
        await using var connection = await db.OpenConnectionAsync(ct);
        await using var transaction = await connection.BeginTransactionAsync(ct);
        NpgsqlCommand Command(string sql) => new(sql,connection,transaction);
        await using (var claim = Command("SELECT pg_advisory_xact_lock(hashtextextended(@key,0))"))
        { claim.Parameters.AddWithValue("key",$"CheckOut:{actorId}:{key}"); await claim.ExecuteNonQueryAsync(ct); }
        var id = CheckOutRequestId(actorId,key);
        var fingerprint = CheckOutFingerprint(request);
        await using (var replay = Command("SELECT payload_hash,outcome FROM integration_inbox WHERE event_id=@id AND event_type='CheckOutRequest'"))
        {
            replay.Parameters.AddWithValue("id",id); await using var reader = await replay.ExecuteReaderAsync(ct);
            if (await reader.ReadAsync(ct))
            {
                if (reader.GetString(0) != fingerprint) throw new ServiceException(409,"Idempotency key reused for another checkout.");
                return JsonSerializer.Deserialize<ConfirmCheckOutResultDto>(reader.GetString(1))!;
            }
        }
        if (verification is null) throw new ServiceException(409,"Verified checkout quote and payment required.");
        var proof = verification.Proof; var payment = verification.Payment;
        if (proof.ActorId != actorId || proof.SessionId != request.SessionId || proof.GateId != request.GateId || proof.Plate != observed)
            throw new ServiceException(409,"Checkout identification does not match the verified quote.");
        // No row locks before the global VEHICLE -> SLOT lock order.
        Guid vehicle; Guid slot;
        await using (var locate = Command("SELECT ps.vehicle_id,a.slot_id FROM parking_sessions ps JOIN session_slot_assignments a ON a.session_id=ps.id AND a.vacated_at IS NULL WHERE ps.id=@session AND ps.status='ACTIVE'"))
        {
            locate.Parameters.AddWithValue("session",request.SessionId); await using var reader = await locate.ExecuteReaderAsync(ct);
            if (!await reader.ReadAsync(ct)) throw new ServiceException(409,"Session is not active.");
            vehicle=reader.GetGuid(0); slot=reader.GetGuid(1);
        }
        await using (var vehicleLock=Command("SELECT lock_parking_resource('VEHICLE',@id)"))
        { vehicleLock.Parameters.AddWithValue("id",vehicle); await vehicleLock.ExecuteNonQueryAsync(ct); }
        await using (var slotLock=Command("SELECT lock_parking_resource('SLOT',@id)"))
        { slotLock.Parameters.AddWithValue("id",slot); await slotLock.ExecuteNonQueryAsync(ct); }
        Guid lot; Guid? booking; string code; decimal fee;
        await using (var read=Command("""
            SELECT ps.lot_id,ps.booking_id,s.code,ps.plate_snapshot,ps.entry_at,ps.expected_exit_at,
                sn.resolved_rules,l.timezone,ps.pricing_snapshot_id,b.starts_at
            FROM parking_sessions ps
            JOIN session_slot_assignments a ON a.session_id=ps.id AND a.vacated_at IS NULL
            JOIN parking_slots s ON s.id=a.slot_id AND s.lot_id=ps.lot_id
            JOIN parking_lots l ON l.id=ps.lot_id JOIN pricing_snapshots sn ON sn.id=ps.pricing_snapshot_id
            LEFT JOIN bookings b ON b.id=ps.booking_id
            WHERE ps.id=@session AND ps.status='ACTIVE' AND ps.vehicle_id=@vehicle AND a.slot_id=@slot
              AND EXISTS(SELECT 1 FROM lot_gates g WHERE g.id=@gate AND g.lot_id=ps.lot_id AND g.gate_kind IN ('EXIT','BOTH'))
            FOR UPDATE OF ps,a
            """))
        {
            read.Parameters.AddWithValue("session",request.SessionId); read.Parameters.AddWithValue("vehicle",vehicle);
            read.Parameters.AddWithValue("slot",slot); read.Parameters.AddWithValue("gate",request.GateId);
            await using var reader=await read.ExecuteReaderAsync(ct);
            if (!await reader.ReadAsync(ct)) throw new ServiceException(409,"Session, slot or exit gate changed. Request a new quote.");
            lot=reader.GetGuid(0); booking=reader.IsDBNull(1)?null:reader.GetGuid(1); code=reader.GetString(2);
            if (!PlateNumber.TryNormalize(reader.GetString(3),out var original) || original!=observed ||
                proof.LotId!=lot || proof.VehicleId!=vehicle || proof.SlotId!=slot || proof.PricingSnapshotId!=reader.GetGuid(8))
                throw new ServiceException(409,"INCIDENT_0482_PLATE_MISMATCH or checkout context changed.");
            fee=CalculateCheckOutFee(booking.HasValue,reader.GetFieldValue<DateTimeOffset>(4),
                reader.GetFieldValue<DateTimeOffset>(5),proof.QuoteAt,reader.GetString(6),reader.GetString(7),
                reader.IsDBNull(9)?null:reader.GetFieldValue<DateTimeOffset>(9));
            var currentFee=CalculateCheckOutFee(booking.HasValue,reader.GetFieldValue<DateTimeOffset>(4),
                reader.GetFieldValue<DateTimeOffset>(5),clock.GetUtcNow(),reader.GetString(6),reader.GetString(7),
                reader.IsDBNull(9)?null:reader.GetFieldValue<DateTimeOffset>(9));
            if(currentFee!=fee)
                throw new ServiceException(409,"Checkout fee changed. Request a new quote; prior payments remain credited.");
        }
        var now=clock.GetUtcNow();
        if (proof.ExpiresAt<=now || proof.QuoteAt>now || proof.GrossAmount!=fee)
            throw new ServiceException(409,"Quote expired or price changed. Request a new quote.");
        if (payment.SessionId!=request.SessionId || payment.LotId!=lot || payment.Currency!="VND" ||
            payment.AmountPaid<fee || (fee>0 && payment.PaymentId is null))
            throw new ServiceException(409,"Verified payment is insufficient for this session.");
        var result=new ConfirmCheckOutResultDto(request.SessionId,booking,lot,slot,code,now,
            payment.AmountPaid,payment.Method,"STAFF_CONFIRMED_EXIT","AVAILABLE",payment.PaymentId);
        await using (var write=Command("""
            UPDATE parking_sessions SET status='COMPLETED',exit_at=@now,exit_gate_id=@gate,exited_by=@actor WHERE id=@session;
            UPDATE session_slot_assignments SET vacated_at=@now WHERE session_id=@session AND vacated_at IS NULL;
            UPDATE bookings SET status='COMPLETED',version=version+1 WHERE id=@booking;
            UPDATE slot_reservations SET status='RELEASED',released_at=@now,release_reason='CHECK_OUT'
                WHERE booking_id=@booking AND status='CONFIRMED';
            INSERT INTO audit_logs(lot_id,actor_user_id,actor_type,action,entity_type,entity_id,request_id,reason,new_values,created_at)
            VALUES(@lot,@actor,'STAFF','CHECK_OUT','PARKING_SESSION',@entity,@request,@notes,@outcome::jsonb,@now);
            INSERT INTO integration_inbox(event_id,event_type,payload_hash,outcome) VALUES(@id,'CheckOutRequest',@hash,@outcome);
            INSERT INTO integration_outbox(event_id,event_type,aggregate_id,payload)
            VALUES(@id,'SlotStatusChanged.v1',@slot,@event::jsonb);
            """))
        {
            write.Parameters.AddWithValue("session",request.SessionId); write.Parameters.AddWithValue("now",now);
            write.Parameters.AddWithValue("gate",request.GateId); write.Parameters.AddWithValue("actor",actorId);
            write.Parameters.Add("booking",NpgsqlDbType.Uuid).Value=(object?)booking??DBNull.Value;
            write.Parameters.AddWithValue("lot",lot); write.Parameters.AddWithValue("entity",request.SessionId.ToString());
            write.Parameters.AddWithValue("request",id.ToString()); write.Parameters.AddWithValue("notes",request.StaffNotes??"");
            write.Parameters.AddWithValue("outcome",JsonSerializer.Serialize(result)); write.Parameters.AddWithValue("id",id);
            write.Parameters.AddWithValue("hash",fingerprint); write.Parameters.AddWithValue("slot",slot);
            write.Parameters.AddWithValue("event",JsonSerializer.Serialize(new { eventId=id,parkingLotId=lot,slotId=slot,status="AVAILABLE",observedAt=now }));
            await write.ExecuteNonQueryAsync(ct);
        }
        await transaction.CommitAsync(ct);
        return result;
    }
}
