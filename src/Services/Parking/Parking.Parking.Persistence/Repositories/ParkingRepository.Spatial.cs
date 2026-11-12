using System.Data;
using Npgsql;
using Parking.Parking.Application.DTOs;

namespace Parking.Parking.Persistence.Repositories;

public sealed partial class ParkingRepository
{
    /// <summary>
    /// Truy vấn chi tiết một bãi đỗ xe từ bảng parking_lots.
    /// </summary>
    public async Task<ParkingLotDetailDto?> GetParkingLotDetailAsync(Guid lotId, CancellationToken ct)
    {
        await using var conn = await db.OpenConnectionAsync(ct);
        return await ReadParkingLotDetailAsync(conn, tx: null, lotId, ct);
    }

    private static async Task<ParkingLotDetailDto?> ReadParkingLotDetailAsync(
        NpgsqlConnection conn,
        NpgsqlTransaction? tx,
        Guid lotId,
        CancellationToken ct)
    {
        const string sql = """
            SELECT id, code, name, address, latitude, longitude, timezone, status, created_at
            FROM parking_lots
            WHERE id = @lotId
            """;

        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("lotId", lotId);
        await using var reader = await cmd.ExecuteReaderAsync(ct);

        if (!await reader.ReadAsync(ct))
            return null;

        return new ParkingLotDetailDto(
            Id: reader.GetGuid(0),
            Code: reader.GetString(1),
            Name: reader.GetString(2),
            Address: reader.GetString(3),
            Latitude: reader.GetDecimal(4),
            Longitude: reader.GetDecimal(5),
            Timezone: reader.GetString(6),
            Status: reader.GetString(7),
            CreatedAt: reader.GetFieldValue<DateTimeOffset>(8));
    }

    /// <summary>
    /// Đọc toàn bộ cây cấu trúc (Levels -> Zones -> Slots + MapObjects) phục vụ Three.js Digital Twin.
    /// </summary>
    public async Task<LotLayout3DDto?> GetLotLayout3DAsync(Guid lotId, CancellationToken ct)
    {
        await using var conn = await db.OpenConnectionAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(IsolationLevel.RepeatableRead, ct);

        // 1. Kiểm tra bãi xe có tồn tại không
        var lot = await ReadParkingLotDetailAsync(conn, tx, lotId, ct);
        if (lot is null)
            return null;

        // 2. Đọc danh sách Tầng (Levels)
        var levels = new List<LevelSpatialDto>();
        const string sqlLevels = """
            SELECT id, code, name, level_kind, elevation_m, display_order
            FROM parking_levels
            WHERE lot_id = @lotId
            ORDER BY display_order ASC
            """;

        await using (var cmdLevels = new NpgsqlCommand(sqlLevels, conn, tx))
        {
            cmdLevels.Parameters.AddWithValue("lotId", lotId);
            await using var readerLevels = await cmdLevels.ExecuteReaderAsync(ct);

            while (await readerLevels.ReadAsync(ct))
            {
                var levelId = readerLevels.GetGuid(0);
                var levelCode = readerLevels.GetString(1);
                var levelName = readerLevels.GetString(2);
                var levelKind = readerLevels.GetString(3);
                var elevationM = readerLevels.GetDecimal(4);
                var displayOrder = readerLevels.GetInt32(5);

                levels.Add(new LevelSpatialDto(
                    levelId, levelCode, levelName, levelKind, elevationM, displayOrder,
                    new List<ZoneSpatialDto>()));
            }
        }

        // 3. Đọc danh sách Khu vực (Zones)
        var zonesByLevel = new Dictionary<Guid, List<ZoneSpatialDto>>();
        const string sqlZones = """
            SELECT id, level_id, code, name
            FROM zones
            WHERE lot_id = @lotId
            ORDER BY code ASC
            """;

        await using (var cmdZones = new NpgsqlCommand(sqlZones, conn, tx))
        {
            cmdZones.Parameters.AddWithValue("lotId", lotId);
            await using var readerZones = await cmdZones.ExecuteReaderAsync(ct);

            while (await readerZones.ReadAsync(ct))
            {
                var zoneId = readerZones.GetGuid(0);
                var levelId = readerZones.GetGuid(1);
                var zoneCode = readerZones.GetString(2);
                var zoneName = readerZones.GetString(3);

                if (!zonesByLevel.TryGetValue(levelId, out var zoneList))
                {
                    zoneList = [];
                    zonesByLevel[levelId] = zoneList;
                }

                zoneList.Add(new ZoneSpatialDto(zoneId, zoneCode, zoneName, new List<SlotSpatialDto>()));
            }
        }

        // 4. Đọc Slots kèm tọa độ 3D từ map_objects thuộc bản PUBLISHED mới nhất (LEFT JOIN)
        var slotsByZone = new Dictionary<Guid, List<SlotSpatialDto>>();
        const string sqlSlots = """
            WITH published_map AS (
                SELECT id
                FROM map_versions
                WHERE lot_id = @lotId AND status = 'PUBLISHED'
                ORDER BY version_no DESC
                LIMIT 1
            )
            SELECT s.id, s.zone_id, s.code, s.operational_status::text, s.width_m, s.length_m,
                   m.x, m.y, m.z, m.rotation_y, m.size_x, m.size_y, m.size_z
            FROM parking_slots s
            LEFT JOIN published_map pm ON TRUE
            LEFT JOIN map_objects m
              ON m.map_version_id = pm.id
             AND m.slot_id = s.id
             AND m.lot_id = @lotId
            WHERE s.lot_id = @lotId
            ORDER BY s.code ASC
            """;

        await using (var cmdSlots = new NpgsqlCommand(sqlSlots, conn, tx))
        {
            cmdSlots.Parameters.AddWithValue("lotId", lotId);
            await using var readerSlots = await cmdSlots.ExecuteReaderAsync(ct);

            while (await readerSlots.ReadAsync(ct))
            {
                var slotId = readerSlots.GetGuid(0);
                var zoneId = readerSlots.GetGuid(1);
                var slotCode = readerSlots.GetString(2);
                var status = readerSlots.GetString(3);
                var widthM = readerSlots.IsDBNull(4) ? (decimal?)null : readerSlots.GetDecimal(4);
                var lengthM = readerSlots.IsDBNull(5) ? (decimal?)null : readerSlots.GetDecimal(5);

                Vector3Dto? position = null;
                decimal? rotationY = null;
                Vector3Dto? size = null;

                if (!readerSlots.IsDBNull(6)) // Nếu có tọa độ 3D từ map_objects
                {
                    position = new Vector3Dto(readerSlots.GetDecimal(6), readerSlots.GetDecimal(7), readerSlots.GetDecimal(8));
                    rotationY = readerSlots.GetDecimal(9);
                    size = new Vector3Dto(readerSlots.GetDecimal(10), readerSlots.GetDecimal(11), readerSlots.GetDecimal(12));
                }

                if (!slotsByZone.TryGetValue(zoneId, out var slotList))
                {
                    slotList = [];
                    slotsByZone[zoneId] = slotList;
                }

                slotList.Add(new SlotSpatialDto(slotId, slotCode, status, widthM, lengthM, position, rotationY, size));
            }
        }

        await tx.CommitAsync(ct);

        // 5. Ráp cây cấu trúc: Gắn Slots vào Zones, gắn Zones vào Levels
        var assembledLevels = levels.Select(lvl =>
        {
            var lvlZones = zonesByLevel.TryGetValue(lvl.Id, out var zList) ? zList : [];
            var assembledZones = lvlZones.Select(z =>
            {
                var zSlots = slotsByZone.TryGetValue(z.Id, out var sList) ? sList : [];
                return z with { Slots = zSlots };
            }).ToList();

            return lvl with { Zones = assembledZones };
        }).ToList();

        return new LotLayout3DDto(lot.Id, lot.Code, lot.Name, assembledLevels);
    }
}