using MediatR;
using Parking.Parking.Application.DTOs;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;



namespace Parking.Parking.Application.Features.ParkingLots.Queries
{
    // Kế thừa IRequest để báo cho hệ thống biết đây là một "Lệnh" cần xử lý
    // SearchParkingLotsResultDto chính là kiểu dữ liệu sẽ trả về sau khi xử lý xong
    public class SearchParkingLotsQuery : IRequest<SearchParkingLotsResultDto>
    {
        // GPS của khách hàng (Có thể rỗng nếu khách không cấp quyền vị trí)
        public double? Latitude { get; set; }
        public double? Longitude { get; set; }

        // Bán kính tìm kiếm (Mặc định 5km)
        public double RadiusKm { get; set; } = 5.0;

        // Loại xe (VD: "CAR" hoặc "MOTORBIKE")
        public string VehicleType { get; set; } = string.Empty;

        // Thời điểm bắt đầu đỗ dự kiến (Nếu không truyền thì tính là ngay lúc này)
        public DateTime? StartTime { get; set; }

        // Thời lượng dự kiến đỗ xe (Tính bằng phút, VD: 180 phút = 3 tiếng)
        public int ExpectedDuration { get; set; }

        // Tiêu chí sắp xếp: "NEAREST" (Gần nhất) hoặc "CHEAPEST" (Rẻ nhất)
        public string SortBy { get; set; } = "NEAREST";
    }
}
