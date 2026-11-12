using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Parking.Application.Interfaces
{

    // Lớp chứa kết quả tính giá
    public class EstimatedPriceResult
    {
        public decimal TotalFee { get; set; }
        public string Currency { get; set; } = "VND";
        public string Details { get; set; } = string.Empty;
    }
    // Hợp đồng dịch vụ tính giá
    public interface IEstimatedPriceService
    {
        Task<EstimatedPriceResult> CalculateEstimatedFeeAsync(
            Guid lotId,
            string vehicleType,
            DateTime startTime,
            int expectedDurationMinutes);
    }
}
