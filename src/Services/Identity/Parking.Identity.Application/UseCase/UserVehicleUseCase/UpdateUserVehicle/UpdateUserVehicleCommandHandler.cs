using MediatR;
using Parking.Identity.Application.Common.AppException;
using Parking.Identity.Application.Common.Enum;
using Parking.Identity.Application.Common.Interface;
using Parking.Identity.Application.DTOs;

namespace Parking.Identity.Application.UseCase.UserVehicleUseCase.UpdateUserVehicle
{
    public class UpdateUserVehicleCommandHandler
        : IRequestHandler<UpdateUserVehicleCommand, UserVehicleDto>
    {
        private readonly IUserVehicleRepository userVehicleRepository;
        private readonly IAccountRepository accountRepository;
        private readonly IUnitOfWork unitOfWork;

        public UpdateUserVehicleCommandHandler(
            IUserVehicleRepository userVehicleRepository,
            IUnitOfWork unitOfWork,
            IAccountRepository accountRepository)
        {
            this.userVehicleRepository = userVehicleRepository;
            this.unitOfWork = unitOfWork;
            this.accountRepository = accountRepository;
        }

        public async Task<UserVehicleDto> Handle(
            UpdateUserVehicleCommand request,
            CancellationToken cancellationToken)
        {
            // 1. Find the current user.
            var user = await accountRepository.GetUserByIdAsync(
                request.UserId,
                cancellationToken);

            if (user is null)
            {
                throw new AppException(
                    ErrorCode.AccountNotFound,
                    "The requested account could not be found.");
            }

            // 2. Find the vehicle owned by the current user.
            var vehicle = await userVehicleRepository.GetVehicleByIdAsync(
                user.Id,
                request.VehicleId,
                cancellationToken);

            if (vehicle is null)
            {
                throw new AppException(
                    ErrorCode.VehicleNotFound,
                    "Vehicle was not found.");
            }

            // 3. Validate and normalize the license plate.
            if (string.IsNullOrWhiteSpace(request.LicensePlate))
            {
                throw new AppException(
                    ErrorCode.InvalidLicensePlate,
                    "License plate is required.");
            }

            var normalizedPlate = request.LicensePlate
                .Trim()
                .Replace(" ", string.Empty)
                .ToUpperInvariant();

            // 4. Check duplicate license plate, excluding this vehicle.
            var plateExists = await userVehicleRepository
                .ExistsLicensePlateAsync(
                    user.Id,
                    normalizedPlate,
                    vehicle.Id,
                    cancellationToken);

            if (plateExists)
            {
                throw new AppException(
                    ErrorCode.VehicleAlreadyExists,
                    "This license plate is already registered.");
            }

            // 5. Validate vehicle type.
            var supportedTypes = new[] { "Car", "EV", "Bike" };

            var matchedType = supportedTypes.FirstOrDefault(type =>
                string.Equals(
                    type,
                    request.VehicleType?.Trim(),
                    StringComparison.OrdinalIgnoreCase));

            if (matchedType is null)
            {
                throw new AppException(
                    ErrorCode.InvalidVehicleType,
                    "Vehicle type must be Car, EV, or Bike.");
            }

            // 6. Handle default vehicle status.
            var existingDefault =
                await userVehicleRepository.GetDefaultUserVehicleAsync(
                    user.Id,
                    cancellationToken);

            if (request.IsDefault)
            {
                // If another vehicle is currently default, unset it.
                if (existingDefault is not null
                    && existingDefault.Id != vehicle.Id)
                {
                    existingDefault.IsDefault = false;
                    existingDefault.UpdatedAt = DateTime.UtcNow;

                    userVehicleRepository.UpdateUserVehicle(existingDefault);
                }

                vehicle.IsDefault = true;
            }
            else
            {
                // Only reject if this vehicle is currently the default.
                if (vehicle.IsDefault)
                {
                    throw new AppException(
                        ErrorCode.ValidationError,
                        "Please select another default vehicle before removing this default status.");
                }

                // This vehicle is already non-default.
                // Keep it non-default and allow other fields to be updated.
                vehicle.IsDefault = false;
            }

            // 7. Update vehicle information.
            vehicle.LicensePlate = normalizedPlate;
            vehicle.VehicleType = matchedType;
            vehicle.UpdatedAt = DateTime.UtcNow;

            userVehicleRepository.UpdateUserVehicle(vehicle);

            // 8. Persist changes.
            await unitOfWork.SaveChangesAsync(cancellationToken);

            // 9. Return DTO.
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