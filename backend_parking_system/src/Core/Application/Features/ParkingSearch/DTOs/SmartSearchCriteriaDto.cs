using ParkingSystem.Domain.Enums;

namespace ParkingSystem.Application.Features.ParkingSearch.DTOs;

/// <summary>
/// Các tiêu chí tìm kiếm bãi xe được AI (LLM) bóc tách từ ngôn ngữ tự nhiên của người dùng
/// </summary>
public record SmartSearchCriteriaDto
{
    /// <summary>
    /// Địa điểm hoặc địa danh mục tiêu (VD: Landmark 81, Chợ Bến Thành, Quận 1)
    /// </summary>
    public string? DestinationName { get; init; }

    /// <summary>
    /// Vĩ độ mục tiêu (Latitude)
    /// </summary>
    public double? Latitude { get; init; }

    /// <summary>
    /// Kinh độ mục tiêu (Longitude)
    /// </summary>
    public double? Longitude { get; init; }

    /// <summary>
    /// Loại phương tiện: Car, Motorbike, ElectricVehicle,...
    /// </summary>
    public VehicleType VehicleType { get; init; } = VehicleType.Car;

    /// <summary>
    /// Mức giá tối đa mỗi giờ mong muốn (VNĐ)
    /// </summary>
    public decimal? MaxPricePerHour { get; init; }

    /// <summary>
    /// Bán kính tìm kiếm mong muốn tính theo mét (mặc định: 1000m)
    /// </summary>
    public int DesiredRadiusMeters { get; init; } = 1000;

    /// <summary>
    /// Thời gian dự kiến gửi xe (giờ), dùng để tính toán Cheapest search
    /// </summary>
    public double ExpectedDurationHours { get; init; } = 2.0;

    /// <summary>
    /// Yêu cầu đặc biệt (VD: sạc điện EV, mái che, qua đêm, hầm xe rộng)
    /// </summary>
    public List<string> SpecialRequirements { get; init; } = [];

    /// <summary>
    /// Tiêu chí ưu tiên chính: "NEAREST" hoặc "CHEAPEST"
    /// </summary>
    public string PriorityStrategy { get; init; } = "NEAREST";
}
