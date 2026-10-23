using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Payment.Application.DTOs
{
    /// <summary>
    /// DTO nhận tham số yêu cầu tính tiền từ Client / Frontend / Swagger.
    /// </summary>
    public record CalculateFeeRequestDto
    {
        public Guid ParkingLotId { get; init; }
        public DateTimeOffset EntryTime { get; init; }
        public DateTimeOffset ExitTime { get; init; }
        public bool IsGoldStarMember { get; init; } = false;
        public string VehicleType { get; init; } = "CAR";
    }
}
