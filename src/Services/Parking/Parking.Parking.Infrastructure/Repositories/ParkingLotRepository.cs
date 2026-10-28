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
}
