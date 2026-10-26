using MediatR;
using Parking.Identity.Application.Common.AppException;
using Parking.Identity.Application.Common.Enum;
using Parking.Identity.Application.Common.Interface;
using Parking.Identity.Application.DTOs;
using Parking.Identity.Domain.Entities;

namespace Parking.Identity.Application.UseCase.UserVehicleUseCase.CreateUserVehicle
{
    public class CreateVehicleCommandHandler : IRequestHandler<CreateVehicleCommand, UserVehicleDto>
    {
        private readonly IUserVehicleRepository userVehicleRepository;
        private readonly IAccountRepository accountRepository;
        private readonly IUnitOfWork unitOfWork;
        private const int MaxVehiclePerUser = 5;
        public CreateVehicleCommandHandler(IUserVehicleRepository userVehicleRepository, IUnitOfWork unitOfWork, IAccountRepository accountRepository)
        {
            this.userVehicleRepository = userVehicleRepository;
            this.unitOfWork = unitOfWork;
            this.accountRepository = accountRepository;
        }
        public async Task<UserVehicleDto> Handle(CreateVehicleCommand request, CancellationToken cancellationToken)
        {
            // 1. Validate license plate
            if (string.IsNullOrWhiteSpace(request.LicensePlate))
            {
                throw new AppException(ErrorCode.InvalidLicensePlate, "License plate format is invalid.");
            }
            var normalizedPlate = request.LicensePlate
                .Trim()
                .Replace(" ", string.Empty)
                .ToUpperInvariant();

            // 2. Normalize vehicle type
            var vehicleType = request.VehicleType.Trim();

            var supportedType = new[] { "Car", "EV", "Bike" };

            var matchedType = supportedType.FirstOrDefault
                (x => string.Equals(x, vehicleType, StringComparison.OrdinalIgnoreCase));

            if (matchedType is null)
            {
                throw new AppException(ErrorCode.InvalidVehicleType, "Vehicle type must be Car, EV, or Bike.");
            }

            // 3. Check whether the account exists
            var user = await accountRepository.GetUserByIdAsync(request.UserId, cancellationToken);
            if (user == null)
            {
                throw new AppException(ErrorCode.AccountNotFound, "The requested account could not be found.");
            }

            // 4. Check duplicate license plate for this user
            var plateExists = await userVehicleRepository.ExistsLicensePlateAsync(user.Id, normalizedPlate, null, cancellationToken);
            if (plateExists)
            {
                throw new AppException(ErrorCode.VehicleAlreadyExists, "This license plate is already registered.");
            }

            // 5. Enforce maximum 5 vehicles
            var vehicleCount = await userVehicleRepository.CountByUserIdAsync(user.Id, cancellationToken);

            if (vehicleCount >= MaxVehiclePerUser)
            {
                throw new AppException(ErrorCode.VehicleLimitExceeded, "A user can register a maximum of 5 vehicles.");
            }

            // 6. Determine default vehicle
            var existingDefault = await userVehicleRepository.GetDefaultUserVehicleAsync(user.Id, cancellationToken);

            var isDefault = request.IsDefault || existingDefault is null;

            // 7. Remove previous default if necessary
            if (isDefault && existingDefault is not null)
            {
                existingDefault.IsDefault = false;
                existingDefault.UpdatedAt = DateTime.UtcNow;

                userVehicleRepository.UpdateUserVehicle(existingDefault);
            }

            var userVehicle = new UserVehicle()
            {
                Id = Guid.NewGuid(),
                UserId = user.Id,
                LicensePlate = normalizedPlate,
                VehicleType = matchedType,
                IsDefault = isDefault,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            await userVehicleRepository.AddVehicleAsync(userVehicle, cancellationToken);

            await unitOfWork.SaveChangesAsync(cancellationToken);

            return new UserVehicleDto
            {
                Id = userVehicle.Id,
                LicensePlate = userVehicle.LicensePlate,
                VehicleType = matchedType,
                IsDefault = isDefault,
                CreatedAt = userVehicle.CreatedAt,
                UpdatedAt = userVehicle.UpdatedAt
            };

        }
    }
}
