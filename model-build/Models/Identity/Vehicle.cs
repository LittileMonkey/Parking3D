using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace ParkingSystem.Models;

public class Vehicle : Entity
{
    public Guid? OwnerUserId { get; set; }
    public User? OwnerUser { get; set; }
    [Required, MaxLength(32)] public string LicensePlate { get; set; } = string.Empty;
    [Required, MaxLength(32)] public string NormalizedPlate { get; set; } = string.Empty;
    public VehicleType VehicleType { get; set; }
    public FuelType FuelType { get; set; } = FuelType.Unknown;
    public bool IsActive { get; set; } = true;
    public bool IsPrimary { get; set; }
}