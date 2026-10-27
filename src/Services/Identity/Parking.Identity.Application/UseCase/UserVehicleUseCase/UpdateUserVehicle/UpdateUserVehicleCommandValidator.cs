using FluentValidation;

namespace Parking.Identity.Application.UseCase.UserVehicleUseCase.UpdateUserVehicle
{
    public class UpdateUserVehicleCommandValidator : AbstractValidator<UpdateUserVehicleCommand>
    {
        public UpdateUserVehicleCommandValidator()
        {
            RuleFor(x => x.UserId)
                .NotEmpty()
                .WithMessage("User ID is required.");

            RuleFor(x => x.VehicleId)
                .NotEmpty()
                .WithMessage("Vehicle ID is required.");

            RuleFor(x => x.LicensePlate)
                .Cascade(CascadeMode.Stop)
                .NotEmpty()
                .WithMessage("License plate is required.")
                .Must(plate =>
                    !string.IsNullOrWhiteSpace(plate) &&
                    System.Text.RegularExpressions.Regex.IsMatch(
                        System.Text.RegularExpressions.Regex.Replace(
                            plate.Trim().ToUpperInvariant(),
                            @"[\s.-]",
                            string.Empty),
                        @"^\d{2}[A-Z]\d?\d{5}$"))
                .WithMessage("License plate format is invalid.");

            RuleFor(x => x.VehicleType)
                .Must(type =>
                    !string.IsNullOrWhiteSpace(type) &&
                    new[] { "Car", "EV", "Bike" }.Contains(
                        type.Trim(),
                        StringComparer.OrdinalIgnoreCase))
                .WithMessage("Vehicle type must be Car, EV, or Bike.");
        }
    }
}
