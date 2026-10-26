using MediatR;
using Parking.Identity.Application.DTOs;

namespace Parking.Identity.Application.UseCase.UserVehicleUseCase.GetUserVehicles
{
    public record GetUserVehiclesQuery : IRequest<List<UserVehicleDto>>
    {
        public Guid UserId { get; set; }
    }
}
