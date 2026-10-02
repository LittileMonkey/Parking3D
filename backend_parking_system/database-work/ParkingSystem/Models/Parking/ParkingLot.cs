using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace ParkingSystem.Models;

public class ParkingLot : Entity
{
    [Required, MaxLength(32)] public string Code { get; set; } = string.Empty;
    [Required, MaxLength(200)] public string Name { get; set; } = string.Empty;
    [MaxLength(2000)] public string? Description { get; set; }
    [Required, MaxLength(500)] public string Address { get; set; } = string.Empty;
    [Range(-90d, 90d)] public double Latitude { get; set; }
    [Range(-180d, 180d)] public double Longitude { get; set; }
    [Required, MaxLength(64)] public string TimeZoneId { get; set; } = "Asia/Ho_Chi_Minh";
    public ParkingLotStatus Status { get; set; } = ParkingLotStatus.Inactive;
    [MaxLength(1000)] public string? MapThumbnailUrl { get; set; }
    public ICollection<ParkingLevel> Levels { get; set; } = new List<ParkingLevel>();
    public ICollection<OperatingHours> OperatingHours { get; set; } = new List<OperatingHours>();
    public ICollection<EntranceExit> Gates { get; set; } = new List<EntranceExit>();
    public ParkingPolicy? Policy { get; set; }
}