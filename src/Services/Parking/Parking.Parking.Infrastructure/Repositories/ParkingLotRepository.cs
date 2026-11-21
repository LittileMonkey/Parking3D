using Npgsql;
using Parking.Parking.Application.Interfaces;
using Parking.Parking.Domain;
using Parking.Parking.Domain.Entities;

namespace Parking.Parking.Infrastructure.Repositories;

public class ParkingLotRepository : IParkingLotRepository
{
    private readonly NpgsqlDataSource _db;
    private readonly TimeProvider _clock;

    public ParkingLotRepository(NpgsqlDataSource db, TimeProvider? timeProvider = null)
    {
        _db = db;
        _clock = timeProvider ?? TimeProvider.System;
    }

    public Task<List<ParkingLot>> GetAvailableLotsAsync(string vehicleType, CancellationToken cancellationToken = default)
        => GetAvailableLotsAsync(vehicleType, _clock.GetUtcNow(), _clock.GetUtcNow().AddHours(1), cancellationToken);

    public async Task<List<ParkingLot>> GetAvailableLotsAsync(string vehicleType, DateTimeOffset startsAt, DateTimeOffset endsAt, CancellationToken cancellationToken = default)
    {
        var resolved = VehicleTypeRules.TryResolve(vehicleType, out var parsed)
            ? parsed
            : new VehicleTypeRules.ResolvedVehicleType(vehicleType.Trim().ToUpperInvariant(), false, vehicleType.Trim().ToUpperInvariant());
        var normalizedType = resolved.BaseVehicleType;
        var isEv = resolved.IsEv;
        var now = _clock.GetUtcNow().UtcDateTime;

        // Truy vấn danh sách bãi ACTIVE có chính sách cho loại xe này và đếm slot khả dụng thực tế
        // Tách biệt hoàn toàn ô Ô tô thường và ô Ô tô điện (EV_CHARGING).
        const string sql = """
            SELECT 
                l.id,
                l.name,
                (l.latitude)::float8,
                (l.longitude)::float8,
                l.status,
                COALESCE(slots_stat.available_count, 0) AS available_slots,
                l.code,
                l.address
            FROM parking_lots l
            JOIN lot_vehicle_policies p ON p.lot_id = l.id AND p.vehicle_type = @vehicleType
            LEFT JOIN (
                SELECT 
                    s.lot_id,
                    COUNT(s.id) AS available_count
                FROM parking_slots s
                JOIN slot_vehicle_types svt ON svt.slot_id = s.id AND svt.vehicle_type = @vehicleType
                WHERE s.operational_status = 'ACTIVE'
                  AND (
                      (@isEv = true AND EXISTS (
                          SELECT 1 FROM slot_feature_links fl
                          WHERE fl.slot_id = s.id AND fl.feature_code IN ('EV', 'EV_CHARGING')
                      ))
                      OR (@isEv = false AND (
                          @vehicleType <> 'CAR'
                          OR NOT EXISTS (
                              SELECT 1 FROM slot_feature_links fl
                              WHERE fl.slot_id = s.id AND fl.feature_code IN ('EV', 'EV_CHARGING')
                          )
                      ))
                  )
                  -- Loại bỏ slot đang có xe đỗ vật lý
                  AND NOT EXISTS (
                      SELECT 1 FROM session_slot_assignments sa 
                      WHERE sa.slot_id = s.id AND sa.vacated_at IS NULL
                  )
                  -- Loại bỏ slot đang có đơn giữ chỗ còn hiệu lực hoặc booking đã xác nhận
                  AND NOT EXISTS (
                      SELECT 1 FROM slot_reservations sr
                      JOIN bookings b ON b.id = sr.booking_id
                      WHERE sr.slot_id = s.id 
                        AND (
                            (sr.status = 'HELD' AND b.status = 'PENDING_PAYMENT' AND b.hold_expires_at > @now)
                            OR (sr.status = 'CONFIRMED' AND b.status IN ('CONFIRMED', 'CHECKED_IN'))
                        )
                        AND tstzrange(sr.starts_at, sr.ends_at, '[)') && tstzrange(@start, @end, '[)')
                  )
                GROUP BY s.lot_id
            ) slots_stat ON slots_stat.lot_id = l.id
            WHERE l.status = 'ACTIVE'
              AND (
                  @isEv = false
                  OR EXISTS (
                      SELECT 1
                      FROM parking_slots s_ev
                      JOIN slot_vehicle_types svt_ev ON svt_ev.slot_id = s_ev.id AND svt_ev.vehicle_type = 'CAR'
                      JOIN slot_feature_links fl_ev ON fl_ev.slot_id = s_ev.id AND fl_ev.feature_code IN ('EV', 'EV_CHARGING')
                      WHERE s_ev.lot_id = l.id AND s_ev.operational_status = 'ACTIVE'
                  )
              )
              AND NOT EXISTS(SELECT 1 FROM lot_closures c WHERE c.lot_id=l.id
                AND tstzrange(c.starts_at,c.ends_at,'[)') && tstzrange(@start,@end,'[)'))
              AND NOT EXISTS (
                SELECT 1 FROM generate_series(date_trunc('minute',@start::timestamptz),@end::timestamptz-interval '1 microsecond',interval '1 minute') t(at)
                WHERE NOT EXISTS(SELECT 1 FROM lot_opening_intervals o WHERE o.lot_id=l.id
                  AND ((extract(isodow FROM t.at AT TIME ZONE l.timezone)-1)*1440
                    + extract(hour FROM t.at AT TIME ZONE l.timezone)*60 + extract(minute FROM t.at AT TIME ZONE l.timezone)) >= o.start_minute
                  AND ((extract(isodow FROM t.at AT TIME ZONE l.timezone)-1)*1440
                    + extract(hour FROM t.at AT TIME ZONE l.timezone)*60 + extract(minute FROM t.at AT TIME ZONE l.timezone)) < o.end_minute)
              );
            """;

        await using var cmd = _db.CreateCommand(sql);
        cmd.Parameters.AddWithValue("vehicleType", normalizedType);
        cmd.Parameters.AddWithValue("isEv", isEv);
        cmd.Parameters.AddWithValue("now", now);
        cmd.Parameters.AddWithValue("start", startsAt.ToUniversalTime());
        cmd.Parameters.AddWithValue("end", endsAt.ToUniversalTime());

        await using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
        var result = new List<ParkingLot>();

        while (await reader.ReadAsync(cancellationToken))
        {
            result.Add(new ParkingLot
            {
                Id = reader.GetGuid(0),
                Name = reader.GetString(1),
                Latitude = reader.GetDouble(2),
                Longitude = reader.GetDouble(3),
                Status = reader.GetString(4),
                AvailableSlots = reader.GetInt32(5),
                Code = reader.IsDBNull(6) ? string.Empty : reader.GetString(6),
                Address = reader.IsDBNull(7) ? string.Empty : reader.GetString(7)
            });
        }

        return result;
    }

    /// <summary>
    /// Thực hiện câu lệnh SQL đọc cấu hình biểu giá hiệu lực (FLAT_BLOCK / FLAT_BLOCK_EV) từ bảng pricing_plans và pricing_rules.
    /// </summary>
    public async Task<int> GetAvailableGraceMinutesAsync(Guid lotId, string vehicleType,
        DateTimeOffset startsAt, Guid customerId, CancellationToken cancellationToken = default)
    {
        var normalizedType = VehicleTypeRules.TryResolve(vehicleType, out var resolved)
            ? resolved.BaseVehicleType : vehicleType.Trim().ToUpperInvariant();
        await using var command = _db.CreateCommand("""
            SELECT p.grace_free_minutes FROM lot_vehicle_policies p
            WHERE p.lot_id=@lot AND p.vehicle_type=@type
              AND NOT EXISTS (
                SELECT 1 FROM daily_grace_claims g WHERE g.user_id=@user
                  AND g.local_day=(@start AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
              )
            """);
        command.Parameters.AddWithValue("lot", lotId);
        command.Parameters.AddWithValue("type", normalizedType);
        command.Parameters.AddWithValue("user", customerId);
        command.Parameters.AddWithValue("start", startsAt.UtcDateTime);
        return await command.ExecuteScalarAsync(cancellationToken) is int minutes ? minutes : 0;
    }

    public async Task<(string Timezone, string ParametersJson)?> GetPricingRuleConfigAsync(
        Guid lotId,
        string vehicleType,
        DateTime startTime,
        CancellationToken cancellationToken = default)
    {
        var resolved = VehicleTypeRules.TryResolve(vehicleType, out var parsed)
            ? parsed
            : new VehicleTypeRules.ResolvedVehicleType(vehicleType.Trim().ToUpperInvariant(), false, vehicleType.Trim().ToUpperInvariant());
        var normalizedType = resolved.BaseVehicleType;
        var ruleType = resolved.PricingRuleType;
        const string sql = """
            SELECT l.timezone, pr.parameters::text
            FROM parking_lots l
            JOIN pricing_plans pp ON pp.lot_id = l.id
            JOIN pricing_rules pr ON pr.plan_id = pp.id AND pr.rule_type = @ruleType
            WHERE l.id = @lotId 
              AND pp.vehicle_type = @vehicleType 
              AND pp.status = 'PUBLISHED'
              AND pp.currency = 'VND'
              AND pp.effective_from <= @startTime
              AND (pp.effective_until IS NULL OR pp.effective_until >= @startTime)
            ORDER BY pp.version_no DESC 
            LIMIT 1;
            """;
        await using var cmd = _db.CreateCommand(sql);
        cmd.Parameters.AddWithValue("lotId", lotId);
        cmd.Parameters.AddWithValue("vehicleType", normalizedType);
        cmd.Parameters.AddWithValue("ruleType", ruleType);
        cmd.Parameters.AddWithValue("startTime", startTime.ToUniversalTime());
        await using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken))
        {
            return null;
        }
        var timezone = reader.GetString(0);
        var parametersJson = reader.GetString(1);
        return (timezone, parametersJson);
    }
}
