using MediatR;
using Parking.Identity.Application.DTOs;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Identity.Application.UseCase.UserVehicleUseCase.CreateUserVehicle
{
    public record CreateVehicleCommand : IRequest<UserVehicleDto>
    {
        public Guid UserId { get; set; }
        public string LicensePlate { get; set; } = string.Empty;
        public string VehicleType { get; set; } = string.Empty;
        public bool IsDefault { get; set; }
    }
}
