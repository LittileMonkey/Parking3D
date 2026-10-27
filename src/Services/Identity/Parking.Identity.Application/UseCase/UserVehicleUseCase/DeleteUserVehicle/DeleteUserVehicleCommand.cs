using MediatR;
using Parking.Identity.Application.DTOs;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Identity.Application.UseCase.UserVehicleUseCase.DeleteUserVehicle
{
    public record DeleteUserVehicleCommand : IRequest<Unit>
    {
        public Guid UserId { get; set; }
        public Guid VehicleId { get; set; }
    }
}
