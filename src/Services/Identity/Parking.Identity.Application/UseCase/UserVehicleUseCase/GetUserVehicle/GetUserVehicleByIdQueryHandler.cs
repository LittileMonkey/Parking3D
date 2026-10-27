using MediatR;
using Parking.Identity.Application.Common.AppException;
using Parking.Identity.Application.Common.Enum;
using Parking.Identity.Application.Common.Interface;
using Parking.Identity.Application.DTOs;

namespace Parking.Identity.Application.UseCase.UserVehicleUseCase.GetUserVehicle
{
    public class GetUserVehicleByIdQueryHandler : IRequestHandler<GetUserVehicleByIdQuery, UserVehicleDto>
    {
        private readonly IAccountRepository accountRepository;
        private readonly IUserVehicleRepository userVehicleRepository;
        public GetUserVehicleByIdQueryHandler(IAccountRepository accountRepository, IUserVehicleRepository userVehicleRepository)
        {
            this.accountRepository = accountRepository;
            this.userVehicleRepository = userVehicleRepository;
        }
        public async Task<UserVehicleDto> Handle(GetUserVehicleByIdQuery request, CancellationToken cancellationToken)
        {
            var user = await accountRepository.GetUserByIdAsync(request.UserId, cancellationToken);

            if(user == null)
            {
                throw new AppException(ErrorCode.AccountNotFound, "The requested account could not be found.");
            }

            var vehicle = await userVehicleRepository.GetVehicleByIdAsync(user.Id, request.VehicleId, cancellationToken);

            if(vehicle == null)
            {
                throw new AppException(ErrorCode.VehicleNotFound, "The requested vehicle could not be found.");
            }
            return new UserVehicleDto
            {
                Id = vehicle.Id,
                LicensePlate = vehicle.LicensePlate,
                VehicleType = vehicle.VehicleType,
                IsDefault = vehicle.IsDefault,
                CreatedAt = vehicle.CreatedAt,
                UpdatedAt = vehicle.UpdatedAt
            };

        }
    }
}
