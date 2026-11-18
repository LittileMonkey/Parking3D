using FluentValidation;
using System.Text.RegularExpressions;

namespace Parking.Identity.Application.UseCase.UserVehicleUseCase.UpdateUserVehicle
{
    public class UpdateUserVehicleCommandValidator : AbstractValidator<UpdateUserVehicleCommand>
    {
        private static readonly Regex VietnamesePlateRegex = new(
            @"^\d{2}([A-Z]{1,2}|[A-Z]\d)\d{4,5}$",
            RegexOptions.Compiled);

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
                    VietnamesePlateRegex.IsMatch(
                        Regex.Replace(
                            plate.Trim().ToUpperInvariant(),
                            @"[\s.-]",
                            string.Empty)))
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
