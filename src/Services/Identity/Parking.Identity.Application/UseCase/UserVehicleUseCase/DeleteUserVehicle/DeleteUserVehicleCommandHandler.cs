using MediatR;
using Parking.Identity.Application.Common.AppException;
using Parking.Identity.Application.Common.Enum;
using Parking.Identity.Application.Common.Interface;

namespace Parking.Identity.Application.UseCase.UserVehicleUseCase.DeleteUserVehicle
{
    public class DeleteUserVehicleCommandHandler : IRequestHandler<DeleteUserVehicleCommand, Unit>
    {
        private readonly IUserVehicleRepository userVehicleRepository;
        private readonly IAccountRepository accountRepository;
        private readonly IUnitOfWork unitOfWork;
        public DeleteUserVehicleCommandHandler(IUserVehicleRepository userVehicleRepository, IUnitOfWork unitOfWork, IAccountRepository accountRepository)
        {
            this.userVehicleRepository = userVehicleRepository;
            this.unitOfWork = unitOfWork;
            this.accountRepository = accountRepository;
        }
        public async Task<Unit> Handle(DeleteUserVehicleCommand request, CancellationToken cancellationToken)
        {
            // 1. Ensure the vehicle belongs to the current user.
            var user = await accountRepository.GetUserByIdAsync(request.UserId, cancellationToken);

            if (user == null)
            {
                throw new AppException(ErrorCode.AccountNotFound, "The requested account could not be found.");
            }

            var vehicle = await userVehicleRepository.GetVehicleByIdAsync(user.Id, request.VehicleId, cancellationToken);

            if (vehicle is null)
            {
                throw new AppException(ErrorCode.VehicleNotFound, "Vehicle was not found.");
            }

            var vehicleCount = await userVehicleRepository.CountByUserIdAsync(user.Id, cancellationToken);

            if (vehicle.IsDefault && vehicleCount == 1)
            {
                throw new AppException(ErrorCode.CannotDeleteDefaultVehicle, "The only default vehicle cannot be deleted.");
            }

            // 2. If deleting the default, assign default to another vehicle.
            if (vehicle.IsDefault)
            {
                var remainingVehicles = await userVehicleRepository.GetUserVehiclesByUserIdAsync(user.Id, cancellationToken);
                var nextDefault = remainingVehicles.FirstOrDefault(x => x.Id != vehicle.Id);

                if (nextDefault is not null)
                {
                    nextDefault.IsDefault = true;
                    nextDefault.UpdatedAt = DateTime.UtcNow;

                    userVehicleRepository.UpdateUserVehicle(nextDefault);
                }
            }

            userVehicleRepository.RemoveUserVehicle(vehicle);
            await unitOfWork.SaveChangesAsync(cancellationToken);
            return Unit.Value;
        }
    }
}
