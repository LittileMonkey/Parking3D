using ParkingSystem.Domain.Common;

namespace ParkingSystem.Domain.Entities;

/// <summary>
/// Thực thể ghi nhận công suất vật lý tại một thời điểm (bảng occupancy_snapshots)
/// </summary>
public class OccupancySnapshot : BaseEntity
{
    public Guid LotId { get; set; }
    public string VehicleType { get; set; } = "CAR";
    public DateTimeOffset ObservedAt { get; set; }
    public int UsableCapacity { get; set; }
    public int OccupiedCount { get; set; }
    public int ReservedCount { get; set; }
    public string DataSource { get; set; } = "ACTUAL"; // ACTUAL, SIMULATED
    public int Version { get; set; } = 1;
}

/// <summary>
/// Thực thể dự báo công suất bãi đỗ xe theo các horizons 30/60/120 phút (bảng occupancy_forecasts)
/// </summary>
public class OccupancyForecast : BaseEntity
{
    public Guid LotId { get; set; }
    public string VehicleType { get; set; } = "CAR";
    public DateTimeOffset GeneratedAt { get; set; }
    public DateTimeOffset TargetAt { get; set; }
    public DateTimeOffset DataCutoffAt { get; set; }
    public int UsableCapacity { get; set; }
    public decimal PredictedOccupied { get; set; }
    public decimal? LowerOccupied { get; set; }
    public decimal? UpperOccupied { get; set; }
    public string ModelVersion { get; set; } = "occupancy-model-v1";
    public string DataSource { get; set; } = "SIMULATED"; // ACTUAL, SIMULATED
    public int Version { get; set; } = 1;
}
