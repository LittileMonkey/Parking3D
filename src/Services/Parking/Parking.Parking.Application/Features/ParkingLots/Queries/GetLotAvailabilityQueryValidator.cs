using FluentValidation;

namespace Parking.Parking.Application.Features.ParkingLots.Queries;

public sealed class GetLotAvailabilityQueryValidator : AbstractValidator<GetLotAvailabilityQuery>
{
    public GetLotAvailabilityQueryValidator()
    {
        RuleFor(x => x.LotId).NotEmpty();
        RuleFor(x => x.LevelId).NotEqual(Guid.Empty).When(x => x.LevelId.HasValue);
        RuleFor(x => x.VehicleType).MaximumLength(30);
        When(x => x.StartTime.HasValue && x.EndTime.HasValue, () =>
        {
            RuleFor(x => x.EndTime).GreaterThan(x => x.StartTime);
            RuleFor(x => x).Must(x => x.EndTime!.Value - x.StartTime!.Value <= TimeSpan.FromDays(31))
                .WithMessage("Availability interval must not exceed 31 days.");
        });
    }
}
