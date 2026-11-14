using Npgsql;
using Parking.ServiceDefaults;

namespace Parking.Parking.Persistence.Repositories;

public sealed partial class ParkingRepository
{
    // Commands are supplied by the caller and share its transaction and verified IDs.
    private static async Task<Guid> RegisterAndLockWalkInVehicleAsync(Func<string, NpgsqlCommand> command, string vehicleType, CancellationToken ct)
    {
        // 5. Đăng ký xe tự động vào bảng vehicles nếu chưa có & đối soát vehicle_type & Khóa VEHICLE
        Guid vehicleId;
        string storedVehicleType;
        await using (var ensureVehicle = command("""
            INSERT INTO vehicles (id, plate_country, plate_normalized, vehicle_type, fuel_type, is_active)
            VALUES (gen_random_uuid(), 'VN', @plate, @type, 'GASOLINE', true)
            ON CONFLICT (plate_country, plate_normalized) DO UPDATE SET is_active=true
            RETURNING id, vehicle_type;
            """))
        {
            await using var reader = await ensureVehicle.ExecuteReaderAsync(ct);
            await reader.ReadAsync(ct);
            vehicleId = reader.GetGuid(0);
            storedVehicleType = reader.GetString(1);
        }

        if (!string.Equals(storedVehicleType, vehicleType, StringComparison.OrdinalIgnoreCase))
            throw new ServiceException(409, $"Registered vehicle plate belongs to vehicle type {storedVehicleType}, not {vehicleType}.");

        await using (var vehicleLock = command("SELECT lock_parking_resource('VEHICLE', @vehicle)"))
        {
            vehicleLock.Parameters.AddWithValue("vehicle", vehicleId);
            await vehicleLock.ExecuteNonQueryAsync(ct);
        }

        // 6. Kiểm tra Single Active Session (BR-12)
        await using (var activeCheck = command("""
            SELECT EXISTS(
                SELECT 1 FROM parking_sessions ps
                WHERE ps.vehicle_id=@vehicle AND ps.status IN ('ACTIVE','EXIT_PENDING')
            )
            """))
        {
            activeCheck.Parameters.AddWithValue("vehicle", vehicleId);
            if ((bool)(await activeCheck.ExecuteScalarAsync(ct))!)
                throw new ServiceException(409, "Vehicle already has an active parking session.");
        }

        return vehicleId;
    }
}
