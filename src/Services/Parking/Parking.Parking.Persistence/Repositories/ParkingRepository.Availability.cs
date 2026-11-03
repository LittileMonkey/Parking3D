using System.Data;
using Npgsql;
using NpgsqlTypes;
using Parking.Parking.Application.DTOs;
using Parking.Parking.Application.Exceptions;
using Parking.Parking.Domain;
using Parking.ServiceDefaults;

namespace Parking.Parking.Persistence.Repositories;

public sealed partial class ParkingRepository
{
    /// <summary>
    /// Tra cứu ô đỗ theo bãi, thời gian, loại xe và tầng; trả về DTO công khai.
    /// Các truy vấn dùng chung snapshot để danh sách và bộ đếm không lệch nhau.
    /// </summary>
    public async Task<LotAvailabilityDto> GetLotAvailabilityAsync(
        Guid lotId,
        DateTimeOffset? startTime,
        DateTimeOffset? endTime,
        string? vehicleType,
        Guid? levelId,
        CancellationToken ct)
    {
        if (lotId == Guid.Empty || levelId == Guid.Empty)
        {
            throw new ServiceException(400, "Non-empty lot and level IDs are required.");
        }

        var now = clock.GetUtcNow();
        var (start, end) = ResolveAvailabilityRange(startTime, endTime, now);
        var type = NormalizeAvailabilityVehicleType(vehicleType);

        await using var connection = await db.OpenConnectionAsync(ct);
        await using var transaction = await connection.BeginTransactionAsync(
            IsolationLevel.RepeatableRead, ct);

        var lot = await ReadAvailabilityLotAsync(connection, transaction, lotId, ct);
        await EnsureAvailabilityScheduleAsync(
            connection, transaction, lotId, lot.Timezone, start, end, ct);
        await EnsureAvailabilityVehicleTypeAsync(connection, transaction, lotId, type, ct);

        var levels = await ReadAvailabilityLevelsAsync(connection, transaction, lotId, levelId, ct);
        await ReadAvailabilitySlotsAsync(
            connection, transaction, lotId, levelId, type, start, end, now, levels, ct);

        // Tính trên chính tập ô đã lọc; không dùng tổng sức chứa của toàn bãi.
        var slots = levels.Values.SelectMany(level => level.Slots).ToArray();
        var resultLevels = levels.Values
            .OrderBy(level => level.DisplayOrder)
            .ThenBy(level => level.Code)
            .Select(level => new LevelAvailabilityItemDto(
                level.Id, level.Code, level.Name, level.Slots))
            .ToList();

        await transaction.CommitAsync(ct);

        return new LotAvailabilityDto(
            lotId,
            lot.Code,
            new QueryTimeRangeDto(start, end),
            slots.Length,
            slots.Count(slot => slot.Status == "AVAILABLE"),
            slots.Count(slot => slot.Status == "HELD"),
            slots.Count(slot => slot.Status == "OCCUPIED"),
            slots.Count(slot => slot.Status == "MAINTENANCE"),
            resultLevels);
    }

    /// <summary>Bổ sung thời gian mặc định và kiểm tra khoảng thực tế sau khi bổ sung.</summary>
    private static (DateTimeOffset Start, DateTimeOffset End) ResolveAvailabilityRange(
        DateTimeOffset? startTime,
        DateTimeOffset? endTime,
        DateTimeOffset now)
    {
        var start = startTime ?? now;
        if (endTime is null && start > DateTimeOffset.MaxValue.AddHours(-1))
        {
            throw new ServiceException(400, "Time range is outside supported bounds.");
        }

        var end = endTime ?? start.AddHours(1);
        if (end <= start || end - start > TimeSpan.FromDays(31))
        {
            throw new ServiceException(400, "Time range must be positive and at most 31 days.");
        }

        return (start, end);
    }

    /// <summary>Chuẩn hóa loại xe; null nghĩa là không áp dụng bộ lọc loại xe.</summary>
    private static string? NormalizeAvailabilityVehicleType(string? vehicleType)
    {
        var type = string.IsNullOrWhiteSpace(vehicleType)
            ? null
            : vehicleType.Trim().ToUpperInvariant();

        if (type is { Length: > 30 })
        {
            throw new ServiceException(400, "Vehicle type is too long.");
        }

        return type;
    }

    /// <summary>Đọc mã bãi và múi giờ; từ chối bãi không tồn tại hoặc không hoạt động.</summary>
    private static async Task<(string Code, string Timezone)> ReadAvailabilityLotAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        Guid lotId,
        CancellationToken ct)
    {
        const string sql = """
            SELECT code, timezone, status
            FROM parking_lots
            WHERE id = @lot
            """;

        await using var command = new NpgsqlCommand(sql, connection, transaction);
        command.Parameters.AddWithValue("lot", lotId);
        await using var reader = await command.ExecuteReaderAsync(ct);

        if (!await reader.ReadAsync(ct))
        {
            throw new NotFoundException("Parking lot not found.");
        }

        if (reader.GetString(2) != "ACTIVE")
        {
            throw new ServiceException(409, "Parking lot is not active.");
        }

        return (reader.GetString(0), reader.GetString(1));
    }

    /// <summary>Kiểm tra lịch mở cửa theo múi giờ bãi và các khoảng đóng cửa đột xuất.</summary>
    private static async Task EnsureAvailabilityScheduleAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        Guid lotId,
        string timezoneId,
        DateTimeOffset start,
        DateTimeOffset end,
        CancellationToken ct)
    {
        var intervals = new List<(int From, int To)>();
        await using (var command = new NpgsqlCommand(
            "SELECT start_minute, end_minute FROM lot_opening_intervals WHERE lot_id = @lot",
            connection, transaction))
        {
            command.Parameters.AddWithValue("lot", lotId);
            await using var reader = await command.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                intervals.Add((reader.GetInt32(0), reader.GetInt32(1)));
            }
        }

        TimeZoneInfo timezone;
        try
        {
            timezone = TimeZoneInfo.FindSystemTimeZoneById(timezoneId);
        }
        catch (Exception exception) when (exception is TimeZoneNotFoundException or InvalidTimeZoneException)
        {
            throw new ServiceException(503, "Lot timezone configuration is invalid.");
        }

        if (!LotOperatingHours.Covers(start, end, timezone, intervals))
        {
            throw new ServiceException(409, "Requested interval is outside lot operating hours.");
        }

        // Hai khoảng [start, end) giao nhau thì bãi không nhận yêu cầu tra cứu này.
        const string closureSql = """
            SELECT EXISTS (
                SELECT 1 FROM lot_closures
                WHERE lot_id = @lot
                  AND tstzrange(starts_at, ends_at, '[)') && tstzrange(@start, @end, '[)')
            )
            """;

        await using var closure = new NpgsqlCommand(closureSql, connection, transaction);
        closure.Parameters.AddWithValue("lot", lotId);
        closure.Parameters.AddWithValue("start", start.UtcDateTime);
        closure.Parameters.AddWithValue("end", end.UtcDateTime);
        if ((bool)(await closure.ExecuteScalarAsync(ct))!)
        {
            throw new ServiceException(409, "Lot is closed during the requested interval.");
        }
    }

    /// <summary>Nếu có bộ lọc loại xe, xác nhận loại đó được bãi hỗ trợ.</summary>
    private static async Task EnsureAvailabilityVehicleTypeAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        Guid lotId,
        string? type,
        CancellationToken ct)
    {
        if (type is null)
        {
            return;
        }

        const string sql = """
            SELECT EXISTS (
                SELECT 1 FROM lot_vehicle_policies
                WHERE lot_id = @lot AND vehicle_type = @type
            )
            """;

        await using var command = new NpgsqlCommand(sql, connection, transaction);
        command.Parameters.AddWithValue("lot", lotId);
        command.Parameters.AddWithValue("type", type);
        if (!(bool)(await command.ExecuteScalarAsync(ct))!)
        {
            throw new ServiceException(400, "Vehicle type is not supported by this lot.");
        }
    }

    /// <summary>Đọc các tầng thuộc đúng bãi; tầng được chỉ định nhưng không thuộc bãi trả 404.</summary>
    private static async Task<Dictionary<Guid, AvailabilityLevel>> ReadAvailabilityLevelsAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        Guid lotId,
        Guid? levelId,
        CancellationToken ct)
    {
        const string sql = """
            SELECT id, code, name, display_order
            FROM parking_levels
            WHERE lot_id = @lot AND (@level IS NULL OR id = @level)
            ORDER BY display_order, code
            """;

        var levels = new Dictionary<Guid, AvailabilityLevel>();
        await using var command = new NpgsqlCommand(sql, connection, transaction);
        command.Parameters.AddWithValue("lot", lotId);
        command.Parameters.Add("level", NpgsqlDbType.Uuid).Value = (object?)levelId ?? DBNull.Value;
        await using var reader = await command.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            var id = reader.GetGuid(0);
            levels.Add(id, new AvailabilityLevel(
                id, reader.GetString(1), reader.GetString(2), reader.GetInt32(3), []));
        }

        if (levelId is not null && levels.Count == 0)
        {
            throw new NotFoundException("Level not found in this parking lot.");
        }

        return levels;
    }

    /// <summary>Đọc ô đã lọc và gắn vào tầng; chỉ hold còn hạn hoặc reservation xác nhận mới chặn lịch.</summary>
    private static async Task ReadAvailabilitySlotsAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        Guid lotId,
        Guid? levelId,
        string? type,
        DateTimeOffset start,
        DateTimeOffset end,
        DateTimeOffset now,
        Dictionary<Guid, AvailabilityLevel> levels,
        CancellationToken ct)
    {
        const string sql = """
            SELECT s.id,s.code,s.level_id,z.code,s.operational_status::text,
              COALESCE((SELECT array_agg(v.vehicle_type ORDER BY v.vehicle_type) FROM slot_vehicle_types v
                WHERE v.slot_id=s.id AND v.lot_id=s.lot_id),ARRAY[]::text[]),
              COALESCE((SELECT array_agg(f.feature_code ORDER BY f.feature_code) FROM slot_feature_links f
                WHERE f.slot_id=s.id),ARRAY[]::text[]),
              EXISTS(SELECT 1 FROM session_slot_assignments a WHERE a.slot_id=s.id AND a.vacated_at IS NULL),
              EXISTS(SELECT 1 FROM slot_reservations r JOIN bookings b ON b.id=r.booking_id
                WHERE r.slot_id=s.id AND tstzrange(r.starts_at,r.ends_at,'[)') && tstzrange(@start,@end,'[)')
                AND ((r.status='HELD' AND b.status='PENDING_PAYMENT' AND b.hold_expires_at>@now)
                  OR (r.status='CONFIRMED' AND b.status IN ('CONFIRMED','CHECKED_IN'))))
            FROM parking_slots s JOIN zones z ON z.id=s.zone_id AND z.lot_id=s.lot_id
            WHERE s.lot_id=@lot AND (@level IS NULL OR s.level_id=@level)
              AND (@type IS NULL OR EXISTS(SELECT 1 FROM slot_vehicle_types v
                WHERE v.slot_id=s.id AND v.lot_id=s.lot_id AND v.vehicle_type=@type))
            ORDER BY s.code,s.id
            """;

        await using var command = new NpgsqlCommand(sql, connection, transaction);
        command.Parameters.AddWithValue("lot", lotId);
        command.Parameters.Add("level", NpgsqlDbType.Uuid).Value = (object?)levelId ?? DBNull.Value;
        command.Parameters.Add("type", NpgsqlDbType.Text).Value = (object?)type ?? DBNull.Value;
        command.Parameters.AddWithValue("start", start.UtcDateTime);
        command.Parameters.AddWithValue("end", end.UtcDateTime);
        command.Parameters.AddWithValue("now", now.UtcDateTime);
        await using var reader = await command.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            var status = GetAvailabilityStatus(
                reader.GetBoolean(7), reader.GetString(4), reader.GetBoolean(8));
            levels[reader.GetGuid(2)].Slots.Add(new SlotAvailabilityItemDto(
                reader.GetGuid(0), reader.GetString(1), reader.GetString(3),
                reader.GetFieldValue<string[]>(5), reader.GetFieldValue<string[]>(6), status));
        }
    }

    /// <summary>Xe đang đỗ được ưu tiên; ô bảo trì và reservation được xét sau trạng thái vật lý.</summary>
    private static string GetAvailabilityStatus(bool physicallyOccupied, string operationalStatus, bool reserved)
    {
        if (physicallyOccupied)
        {
            return "OCCUPIED";
        }

        if (operationalStatus != "ACTIVE")
        {
            return "MAINTENANCE";
        }

        return reserved ? "HELD" : "AVAILABLE";
    }

    // Dữ liệu ghép tạm trong một request; không lưu trạng thái khách hàng trong bộ nhớ dùng chung.
    private sealed record AvailabilityLevel(
        Guid Id, string Code, string Name, int DisplayOrder, List<SlotAvailabilityItemDto> Slots);
}
