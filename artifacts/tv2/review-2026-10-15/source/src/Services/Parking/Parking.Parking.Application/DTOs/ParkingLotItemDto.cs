using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Parking.Application.DTOs
{
    public class ParkingLotItemDto
    {
        public Guid ParkingLotId { get; set; }
        public string Code { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Address { get; set; } = string.Empty;

        public double Latitude { get; set; }
        public double Longitude { get; set; }

        // Khoảng cách từ khách đến bãi xe (Đơn vị: Km)
        public double DistanceKm { get; set; }

        // Số chỗ trống hiện tại
        public int AvailableSlots { get; set; }
        public string OperatingStatus { get; set; } = string.Empty;

        // Khối báo giá (Rất quan trọng cho tiêu chí CHEAPEST)
        public EstimatedPricingDto EstimatedPricing { get; set; } = new();

        // Các tiện ích phụ (VD: Sạc điện EV, Có mái che...)
        public List<string> SupportedFeatures { get; set; } = new();
    }
}
