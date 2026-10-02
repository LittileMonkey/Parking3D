using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace ParkingSystem.Models;

public class OperatingHours : Entity
{
    public Guid ParkingLotId { get; set; }
    public ParkingLot ParkingLot { get; set; } = null!;
    public DayOfWeek DayOfWeek { get; set; }
    public bool IsClosed { get; set; }
    public bool IsOpen24Hours { get; set; }
    public TimeOnly? OpensAt { get; set; }
    public TimeOnly? ClosesAt { get; set; }
    // True means ClosesAt belongs to the following local calendar day.
    public bool ClosesNextDay { get; set; }
}