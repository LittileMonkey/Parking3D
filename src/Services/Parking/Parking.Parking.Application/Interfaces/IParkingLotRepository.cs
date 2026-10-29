using Parking.Parking.Domain.Entities;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Parking.Application.Interfaces
{
    public interface IParkingLotRepository
    {
        // Yêu cầu: Trả về danh sách bãi xe ĐANG HOẠT ĐỘNG, đúng LOẠI XE, và CÒN CHỖ TRỐNG
        Task<List<ParkingLot>> GetAvailableLotsAsync(string vehicleType, CancellationToken cancellationToken = default);


        /// <summary>
        /// Truy vấn cấu hình biểu giá hiệu lực từ CSDL theo bãi đỗ xe, loại xe và thời điểm gửi.
        /// Trả về null nếu bãi chưa có biểu giá hoặc biểu giá đã hết hạn.
        /// </summary>
        Task<(string Timezone, string ParametersJson)?> GetPricingRuleConfigAsync(
            Guid lotId, 
            string vehicleType, 
            DateTime startTime, 
            CancellationToken cancellationToken = default);



    }

}
