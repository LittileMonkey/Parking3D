using FluentValidation;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Parking.Application.Features.ParkingLots.Queries
{
    // Kế thừa AbstractValidator và truyền cái Query của bạn vào để nó bắt lỗi
    public class SearchParkingLotsQueryValidator : AbstractValidator<SearchParkingLotsQuery>
    {
        public SearchParkingLotsQueryValidator()
        {
            // 1. Thời gian đỗ xe bắt buộc phải > 0
            RuleFor(x => x.ExpectedDuration)
                .InclusiveBetween(30, 1440)
                .WithMessage("ExpectedDuration (Thời lượng đỗ xe) phải từ 30 đến 1440 phút.");
            // 2. Bắt buộc phải chọn loại xe
            RuleFor(x => x.VehicleType)
                .NotEmpty()
                .WithMessage("Bắt buộc phải truyền VehicleType (Ví dụ: CAR hoặc MOTORBIKE).");
            // 3. Nếu khách chọn tìm Bãi đỗ GẦN NHẤT (NEAREST) -> Ép buộc phải bật GPS
            RuleFor(x => x.SortBy).Must(value => string.Equals(value,"NEAREST",StringComparison.OrdinalIgnoreCase) || string.Equals(value,"CHEAPEST",StringComparison.OrdinalIgnoreCase));
            RuleFor(x => x.VehicleType).Must(value => string.Equals(value,"CAR",StringComparison.OrdinalIgnoreCase) || string.Equals(value,"MOTORBIKE",StringComparison.OrdinalIgnoreCase));
            RuleFor(x => x.Latitude).InclusiveBetween(-90,90).When(x => x.Latitude.HasValue);
            RuleFor(x => x.Longitude).InclusiveBetween(-180,180).When(x => x.Longitude.HasValue);
            RuleFor(x => x).Must(x => x.Latitude.HasValue == x.Longitude.HasValue).WithMessage("Provide both latitude and longitude.");
            When(x => string.Equals(x.SortBy,"NEAREST", StringComparison.OrdinalIgnoreCase), () =>
            {
                RuleFor(x => x.Latitude)
                    .NotNull()
                    .WithMessage("Latitude (Vĩ độ) là bắt buộc khi sắp xếp theo NEAREST.");

                RuleFor(x => x.Longitude)
                    .NotNull()
                    .WithMessage("Longitude (Kinh độ) là bắt buộc khi sắp xếp theo NEAREST.");
            });

            // 4. Giới hạn bán kính tìm kiếm (ví dụ tối đa 50km để DB không bị quá tải)
            RuleFor(x => x.RadiusKm)
                .GreaterThan(0)
                .LessThanOrEqualTo(50)
                .WithMessage("Bán kính tìm kiếm (RadiusKm) phải lớn hơn 0 và tối đa là 50km.");
        }
    }
}
