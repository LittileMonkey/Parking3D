using FluentValidation;

namespace Parking.Parking.Application.Features.ParkingLots.Queries;

/// <summary>
/// Validator kiểm tra ràng buộc đầu vào cho GetParkingLotDetailQuery
/// </summary>
public sealed class GetParkingLotDetailQueryValidator : AbstractValidator<GetParkingLotDetailQuery>
{
    public GetParkingLotDetailQueryValidator()
    {
        RuleFor(x => x.LotId)
            .NotEmpty().WithMessage("Mã bãi đỗ xe không được để trống.");
    }
}

