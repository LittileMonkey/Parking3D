using FluentValidation;
using System.Text.RegularExpressions;

namespace Parking.Identity.Application.UseCase.UserVehicleUseCase.CreateUserVehicle
{
    public class CreateVehicleCommandValidators : AbstractValidator<CreateVehicleCommand>
    {
        private static readonly string[] SupportedVehicleTypes =
        {
            "Car",
            "EV",
            "Bike"
        };

        public CreateVehicleCommandValidators()
        {
            // 1. Validate UserId
            RuleFor(x => x.UserId)
                .NotEmpty()
                .WithMessage("User ID is required.");

            // 2. Validate license plate
            RuleFor(x => x.LicensePlate)
                .Cascade(CascadeMode.Stop)
                .NotEmpty()
                .WithMessage("License plate is required.")
                .Must(BeValidLicensePlate)
                .WithMessage("License plate format is invalid.");

            // 3. Validate vehicle type
            RuleFor(x => x.VehicleType)
                .Cascade(CascadeMode.Stop)
                .NotEmpty()
                .WithMessage("Vehicle type is required.")
                .Must(BeSupportedVehicleType)
                .WithMessage("Vehicle type must be Car, EV, or Bike.");
        }

        private static bool BeValidLicensePlate(string? licensePlate)
        {
            if (string.IsNullOrWhiteSpace(licensePlate))
            {
                return false;
            }

            // Remove spaces, hyphens, and dots before validation.
            var normalized = Regex.Replace(
                licensePlate.Trim().ToUpperInvariant(),
                @"[\s.-]",
                string.Empty);

            // Simplified MVP format:
            // 51A12345, 51A112345, etc.
            // This is not a complete validator for every Vietnamese plate type.
            return Regex.IsMatch(normalized, @"^\d{2}[A-Z]\d?\d{5}$");
        }

        private static bool BeSupportedVehicleType(string? vehicleType)
        {
            if (string.IsNullOrWhiteSpace(vehicleType))
            {
                return false;
            }

            return SupportedVehicleTypes.Any(
                type => string.Equals(
                    type,
                    vehicleType.Trim(),
                    StringComparison.OrdinalIgnoreCase));
        }
    }
}
