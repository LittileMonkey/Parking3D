using Parking.Parking.Application.DTOs;
using Npgsql;
using Parking.Parking.Application.Interfaces;
using Parking.ServiceDefaults;
namespace Parking.Parking.Persistence.Repositories;

public sealed partial class ParkingRepository
{
    public async Task<BookingQrContextDto?> GetBookingQrContextAsync(
        Guid bookingId,
        CancellationToken ct)
    {
        const string sql = """
            SELECT
                id,
                code,
                lot_id,
                vehicle_id,
                customer_id,
                status::text,
                arrival_deadline
            FROM bookings
            WHERE id = @bookingId
            """;

        await using var command = db.CreateCommand(sql);

        command.Parameters.AddWithValue(
            "bookingId",
            bookingId);

        await using var reader =
            await command.ExecuteReaderAsync(ct);

        if (!await reader.ReadAsync(ct))
        {
            return null;
        }

        return new BookingQrContextDto(
            reader.GetGuid(0),
            reader.GetString(1),
            reader.GetGuid(2),
            reader.GetGuid(3),
            reader.IsDBNull(4) ? null : reader.GetGuid(4),
            reader.GetString(5),
            reader.GetFieldValue<DateTimeOffset>(6)
        );
    }

    public async Task SaveIssuedQrTokenAsync(
    Guid bookingId,
    Guid expectedLotId,
    Guid expectedVehicleId,
    GeneratedQrToken token,
    CancellationToken ct)
    {
        await using var connection =
            await db.OpenConnectionAsync(ct);

        await using var transaction =
            await connection.BeginTransactionAsync(ct);

        // 1. Khóa xe trước.
        await using (var vehicleLock = new NpgsqlCommand(
            "SELECT lock_parking_resource('VEHICLE', @vehicleId)",
            connection,
            transaction))
        {
            vehicleLock.Parameters.AddWithValue(
                "vehicleId",
                expectedVehicleId);

            await vehicleLock.ExecuteNonQueryAsync(ct);
        }

        // 2. Tìm slot đã được xác nhận cho booking.
        const string findSlotSql = """
        SELECT r.slot_id
        FROM bookings b
        JOIN slot_reservations r ON r.booking_id = b.id
        WHERE b.id = @bookingId
          AND b.lot_id = @lotId
          AND b.vehicle_id = @vehicleId
          AND b.status = 'CONFIRMED'
          AND r.status = 'CONFIRMED'
        """;

        Guid slotId;

        await using (var findSlot = new NpgsqlCommand(
            findSlotSql,
            connection,
            transaction))
        {
            findSlot.Parameters.AddWithValue("bookingId", bookingId);
            findSlot.Parameters.AddWithValue("lotId", expectedLotId);
            findSlot.Parameters.AddWithValue("vehicleId", expectedVehicleId);

            var result = await findSlot.ExecuteScalarAsync(ct);

            if (result is not Guid confirmedSlotId)
            {
                throw new ServiceException(
                    409,
                    "Booking chưa đủ điều kiện cấp QR.");
            }

            slotId = confirmedSlotId;
        }

        // 3. Khóa slot sau khi đã khóa xe.
        await using (var slotLock = new NpgsqlCommand(
            "SELECT lock_parking_resource('SLOT', @slotId)",
            connection,
            transaction))
        {
            slotLock.Parameters.AddWithValue("slotId", slotId);

            await slotLock.ExecuteNonQueryAsync(ct);
        }

        // 4. Đọc lại trạng thái sau khi đã lấy đủ khóa.
        const string validateSql = """
        SELECT b.id
        FROM bookings b
        JOIN slot_reservations r ON r.booking_id = b.id
        JOIN parking_slots s
          ON s.id = r.slot_id AND s.lot_id = b.lot_id
        JOIN parking_lots l ON l.id = b.lot_id
        JOIN vehicles v ON v.id = b.vehicle_id
        WHERE b.id = @bookingId
          AND b.lot_id = @lotId
          AND b.vehicle_id = @vehicleId
          AND b.status = 'CONFIRMED'
          AND r.slot_id = @slotId
          AND r.status = 'CONFIRMED'
          AND s.operational_status = 'ACTIVE'
          AND l.status = 'ACTIVE'
          AND v.is_active
          AND @expiresAt > clock_timestamp()
          AND @expiresAt <= b.arrival_deadline
          AND NOT EXISTS (
              SELECT 1
              FROM session_slot_assignments a
              WHERE a.slot_id = s.id
                AND a.vacated_at IS NULL
          )
        FOR UPDATE OF b, r
        """;

        await using (var validate = new NpgsqlCommand(
            validateSql,
            connection,
            transaction))
        {
            validate.Parameters.AddWithValue("bookingId", bookingId);
            validate.Parameters.AddWithValue("lotId", expectedLotId);
            validate.Parameters.AddWithValue("vehicleId", expectedVehicleId);
            validate.Parameters.AddWithValue("slotId", slotId);
            validate.Parameters.AddWithValue(
                "expiresAt",
                token.ExpiresAt.UtcDateTime);

            if (await validate.ExecuteScalarAsync(ct) is null)
            {
                throw new ServiceException(
                    409,
                    "Booking, slot hoặc hạn dùng QR không còn hợp lệ.");
            }
        }

        // 5. Thu hồi QR cũ và lưu QR mới trong cùng transaction.
        const string saveSql = """
        UPDATE qr_tokens
        SET revoked_at = clock_timestamp()
        WHERE booking_id = @bookingId
          AND consumed_at IS NULL
          AND revoked_at IS NULL;

        INSERT INTO qr_tokens (
            booking_id,
            nonce_hash,
            expires_at,
            created_at
        )
        VALUES (
            @bookingId,
            @nonceHash,
            @expiresAt,
            clock_timestamp()
        );
        """;

        await using (var save = new NpgsqlCommand(
            saveSql,
            connection,
            transaction))
        {
            save.Parameters.AddWithValue("bookingId", bookingId);
            save.Parameters.AddWithValue("nonceHash", token.NonceHash);
            save.Parameters.AddWithValue(
                "expiresAt",
                token.ExpiresAt.UtcDateTime);

            await save.ExecuteNonQueryAsync(ct);
        }

        await transaction.CommitAsync(ct);
    }
}