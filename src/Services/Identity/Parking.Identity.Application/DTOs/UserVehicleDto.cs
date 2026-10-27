namespace Parking.Identity.Application.DTOs
{
    public class UserVehicleDto
    {
        public Guid Id { get; set; }

        public string LicensePlate { get; set; } = string.Empty;

        public string VehicleType { get; set; } = string.Empty;

        public bool IsDefault { get; set; }

        public DateTime CreatedAt { get; set; }

        public DateTime UpdatedAt { get; set; }
    }
}
