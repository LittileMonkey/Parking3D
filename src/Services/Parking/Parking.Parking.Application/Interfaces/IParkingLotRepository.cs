using Parking.Parking.Domain;
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
    }

}
