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

        private static readonly Regex VietnamesePlateRegex = new(
            @"^\d{2}([A-Z]{1,2}|[A-Z]\d)\d{4,5}$",
            RegexOptions.Compiled);

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

            // Supports:
            // - Cars (standard: 51A12345, 51A1234; special: 51LD12345)
            // - Motorbikes new format Circular 24/2023: 78AL12345, 59AA12345, 29AB1234
            // - Motorbikes legacy format: 59P167890, 59F11234
            return VietnamesePlateRegex.IsMatch(normalized);
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
