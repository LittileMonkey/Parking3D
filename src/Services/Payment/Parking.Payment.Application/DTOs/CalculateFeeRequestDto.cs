using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Payment.Application.DTOs
{
    /// <summary>
    /// DTO nhận tham số yêu cầu tính tiền từ Client / Frontend / Swagger.
    /// Đã tách riêng ngày và giờ, hỗ trợ mặc định ngày hôm nay nếu Client không nhập.
    /// </summary>
    public record CalculateFeeRequestDto
    {
        /// <summary>Mã định danh bãi đỗ xe</summary>
        public Guid ParkingLotId { get; init; }
        /// <summary>Ngày vào (Định dạng: yyyy-MM-dd). Để trống sẽ mặc định là HÔM NAY.</summary>
        public DateOnly? Date { get; init; }
        /// <summary>Ngày ra (Định dạng: yyyy-MM-dd). Tùy chọn nếu đỗ qua đêm, mặc định bằng Date.</summary>
        public DateOnly? EndDate { get; init; }
        /// <summary>Giờ vào bãi (Định dạng: HH:mm hoặc HH:mm:ss). Để trống sẽ mặc định là GIỜ HIỆN TẠI.</summary>
        public TimeOnly? StartTime { get; init; }
        /// <summary>Giờ ra bãi (Định dạng: HH:mm hoặc HH:mm:ss). Để trống sẽ mặc định là StartTime + 1 giờ.</summary>
        public TimeOnly? EndTime { get; init; }
        /// <summary>Khách hàng có phải thành viên Gold Star không (chiết khấu 10%)</summary>
        public bool IsGoldStarMember { get; init; } = false;
        /// <summary>Loại phương tiện: CAR hoặc MOTORBIKE</summary>
        public string VehicleType { get; init; } = "CAR";
    }
}
