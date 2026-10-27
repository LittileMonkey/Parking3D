using FluentValidation;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Payment.Application.UseCase.CalculateFee
{
    /// <summary>
    /// Bộ gác cổng kiểm tra tính hợp lệ dữ liệu đầu vào của CalculateFeeQuery bằng FluentValidation.
    /// Tự động được MediatR ValidationBehavior quét và thực thi trước khi chuyển đến Handler.
    /// </summary>
    public class CalculateFeeQueryValidator : AbstractValidator<CalculateFeeQuery>
    {
        public CalculateFeeQueryValidator()
        {
            // Kiểm tra mã bãi đỗ xe không được Guid rỗng
            RuleFor(x => x.ParkingLotId)
                .NotEmpty()
                .WithMessage("Mã bãi đỗ xe (ParkingLotId) không được để trống.");

            // Kiểm tra thời gian vào bãi không được để mặc định (Default)
            RuleFor(x => x.EntryTime)
                .NotEmpty()
                .WithMessage("Thời gian vào bãi (EntryTime) không hợp lệ.");

            // Kiểm tra thời gian ra bãi phải lớn hơn thời gian vào
            RuleFor(x => x.ExitTime)
                .NotEmpty()
                .WithMessage("Thời gian ra bãi (ExitTime) không được để trống.")     
                .GreaterThan(x => x.EntryTime)
                .WithMessage("Thời gian ra bãi (ExitTime) phải lớn hơn thời gian vào (EntryTime).");
            //Phòng thủ khoảng thời gian gửi xe bất thường (Chống tấn công từ chối dịch vụ hoặc nhập nhầm)

            RuleFor(x => (x.ExitTime - x.EntryTime).TotalDays)
                 .LessThanOrEqualTo(30)
                 .WithMessage("Khoảng thời gian gửi xe cho một lần tính cước không được vượt quá 30 ngày.");

            // Kiểm tra loại phương tiện không được rỗng
            RuleFor(x => x.VehicleType)
                .NotEmpty()
                .WithMessage("Loại phương tiện (VehicleType) không được để trống.");
        }


    }

}
