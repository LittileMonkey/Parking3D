using MediatR;
using Parking.Identity.Application.DTOs;

namespace Parking.Identity.Application.UseCase.UserVehicleUseCase.GetUserVehicle
{
    public class GetUserVehicleByIdQuery : IRequest<UserVehicleDto>
    {
        public Guid UserId { get; set; }
        public Guid VehicleId { get; set; }

    }
}
