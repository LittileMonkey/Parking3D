using MediatR;
using Parking.Payment.Application.DTOs;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Payment.Application.UseCase.CalculateFee
{
    /// <summary>
    /// Query yêu cầu tính toán tiền cước đỗ xe theo mô hình CQRS.
    /// Kế thừa IRequest<FeeCalculationResultDto> để MediatR kích hoạt ValidationBehavior và chuyển tiếp đến Handler.
    /// </summary>
    public record CalculateFeeQuery(Guid ParkingLotId, DateTimeOffset EntryTime, DateTimeOffset ExitTime, bool isGoldStarMember = false, string VehicleType = "CAR") : IRequest<FeeCalculationResultDto>;
}
