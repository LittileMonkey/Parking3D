using FluentValidation;

namespace Parking.Parking.Application.Features.ParkingLots.Queries;

// Kiểm tra tính hợp lệ tham số đầu vào cho query khả dụng bãi xe
public class GetLotAvailabilityQueryValidator : AbstractValidator<GetLotAvailabilityQuery>
{
    public GetLotAvailabilityQueryValidator()
    {
        RuleFor(x => x.LotId)
            .NotEmpty()
            .WithMessage("LotId không được để trống.");

        When(x => x.StartTime.HasValue && x.EndTime.HasValue, () =>
        {
            RuleFor(x => x.EndTime)
                .GreaterThan(x => x.StartTime)
                .WithMessage("EndTime phải lớn hơn StartTime.");
        });
    }
}
