using FluentValidation;

namespace Parking.Parking.Application.Features.ParkingLots.Queries;

/// <summary>
/// Validator kiểm tra ràng buộc đầu vào cho GetLotLayout3DQuery
/// </summary>
public sealed class GetLotLayout3DQueryValidator : AbstractValidator<GetLotLayout3DQuery>
{
    public GetLotLayout3DQueryValidator()
    {
        RuleFor(x => x.LotId)
            .NotEmpty().WithMessage("Mã bãi đỗ xe không được để trống.");
    }
}

