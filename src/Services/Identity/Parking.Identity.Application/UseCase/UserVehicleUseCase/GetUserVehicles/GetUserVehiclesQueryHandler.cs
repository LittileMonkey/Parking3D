using MediatR;
using Parking.Identity.Application.Common.AppException;
using Parking.Identity.Application.Common.Enum;
using Parking.Identity.Application.Common.Interface;
using Parking.Identity.Application.DTOs;

namespace Parking.Identity.Application.UseCase.UserVehicleUseCase.GetUserVehicles
{
    public class GetUserVehiclesQueryHandler : IRequestHandler<GetUserVehiclesQuery, List<UserVehicleDto>>
    {
        private readonly IAccountRepository accountRepository;
        private readonly IUserVehicleRepository userVehicleRepository;
        public GetUserVehiclesQueryHandler(IAccountRepository accountRepository, IUserVehicleRepository userVehicleRepository)
        {
            this.accountRepository = accountRepository;
            this.userVehicleRepository = userVehicleRepository;
        }

        async Task<List<UserVehicleDto>> IRequestHandler<GetUserVehiclesQuery, List<UserVehicleDto>>.Handle(GetUserVehiclesQuery request, CancellationToken cancellationToken)
        {
            var user = await accountRepository.GetUserByIdAsync(request.UserId, cancellationToken);

            if(user == null)
            {
                throw new AppException(ErrorCode.AccountNotFound, "The requested account could not be found.");
            }

            var userVehicles = await userVehicleRepository.GetUserVehiclesByUserIdAsync(user.Id, cancellationToken);

            return userVehicles.Select(vehicle => new UserVehicleDto
            {
                Id = vehicle.Id,
                LicensePlate = vehicle.LicensePlate,
                IsDefault = vehicle.IsDefault,
                VehicleType = vehicle.VehicleType,
                CreatedAt = vehicle.CreatedAt,
                UpdatedAt = vehicle.UpdatedAt
            }).ToList();
        }
    }
}
