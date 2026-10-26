using MediatR;
using Parking.Identity.Application.DTOs;

namespace Parking.Identity.Application.UseCase.UserVehicleUseCase.UpdateUserVehicle
{
    public record UpdateUserVehicleCommand : IRequest<UserVehicleDto>
    {
        public Guid UserId { get; set; }
        public Guid VehicleId { get; set; }
        public string LicensePlate { get; set; } = string.Empty;
        public string VehicleType { get; set; } = string.Empty;
        public bool IsDefault { get; set; }

    }
}
