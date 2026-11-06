namespace Parking.Parking.Application.DTOs;

/// <summary>
/// Tọa độ 3 chiều (x, y, z) phục vụ render Three.js Digital Twin
/// </summary>
public record Vector3Dto(decimal X, decimal Y, decimal Z);

/// <summary>
/// Chi tiết một bãi đỗ xe trong chuỗi Multi-Parking
/// </summary>
public record ParkingLotDetailDto(
    Guid Id,
    string Code,
    string Name,
    string Address,
    decimal Latitude,
    decimal Longitude,
    string Timezone,
    string Status,
    DateTimeOffset CreatedAt);

/// <summary>
/// Thông tin một ô đỗ kèm tọa độ 3D
/// </summary>
public record SlotSpatialDto(
    Guid Id,
    string Code,
    string OperationalStatus,
    decimal? WidthM,
    decimal? LengthM,
    Vector3Dto? Position,
    decimal? RotationY,
    Vector3Dto? Size);

/// <summary>
/// Thông tin một phân khu (Zone)
/// </summary>
public record ZoneSpatialDto(
    Guid Id,
    string Code,
    string Name,
    IReadOnlyList<SlotSpatialDto> Slots);

/// <summary>
/// Thông tin một tầng (Level)
/// </summary>
public record LevelSpatialDto(
    Guid Id,
    string Code,
    string Name,
    string LevelKind,
    decimal ElevationM,
    int DisplayOrder,
    IReadOnlyList<ZoneSpatialDto> Zones);

/// <summary>
/// Toàn bộ cây cấu trúc bãi đỗ xe phục vụ vẽ bản đồ 3D trong 1 lượt gọi API
/// </summary>
public record LotLayout3DDto(
    Guid LotId,
    string Code,
    string Name,
    IReadOnlyList<LevelSpatialDto> Levels);