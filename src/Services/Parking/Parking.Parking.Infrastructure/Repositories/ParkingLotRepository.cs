using Npgsql;
using Parking.Parking.Application.Interfaces;
using Parking.Parking.Domain.Entities;

namespace Parking.Parking.Infrastructure.Repositories;

public class ParkingLotRepository : IParkingLotRepository
{
    private readonly NpgsqlDataSource _db;

    public ParkingLotRepository(NpgsqlDataSource db)
    {
        _db = db;
    }

    public async Task<List<ParkingLot>> GetAvailableLotsAsync(string vehicleType, CancellationToken cancellationToken = default)
    {
        var normalizedType = vehicleType.Trim().ToUpperInvariant();

        // Truy vấn danh sách bãi ACTIVE có chính sách cho loại xe này và đếm slot khả dụng thực tế
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
                  -- Loại bỏ slot đang có xe đỗ vật lý
                  AND NOT EXISTS (
                      SELECT 1 FROM session_slot_assignments sa 
                      WHERE sa.slot_id = s.id AND sa.vacated_at IS NULL
                  )
                  -- Loại bỏ slot đang có đơn giữ chỗ còn hiệu lực
                  AND NOT EXISTS (
                      SELECT 1 FROM slot_reservations sr
                      JOIN bookings b ON b.id = sr.booking_id
                      WHERE sr.slot_id = s.id 
                        AND sr.status IN ('HELD', 'CONFIRMED')
                        AND b.status IN ('PENDING_PAYMENT', 'CONFIRMED')
                        AND sr.ends_at > now() AND sr.starts_at <= now()
                  )
                GROUP BY s.lot_id
            ) slots_stat ON slots_stat.lot_id = l.id
            WHERE l.status = 'ACTIVE';
            """;

        await using var cmd = _db.CreateCommand(sql);
        cmd.Parameters.AddWithValue("vehicleType", normalizedType);

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
    /// Thực hiện câu lệnh SQL đọc cấu hình biểu giá hiệu lực (FLAT_BLOCK) từ bảng pricing_plans và pricing_rules.
    /// </summary>
    public async Task<(string Timezone, string ParametersJson)?> GetPricingRuleConfigAsync(
        Guid lotId,
        string vehicleType,
        DateTime startTime,
        CancellationToken cancellationToken = default)
    {
        var normalizedType = vehicleType.Trim().ToUpperInvariant();
        const string sql = """
            SELECT l.timezone, pr.parameters::text
            FROM parking_lots l
            JOIN pricing_plans pp ON pp.lot_id = l.id
            JOIN pricing_rules pr ON pr.plan_id = pp.id AND pr.rule_type = 'FLAT_BLOCK'
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
