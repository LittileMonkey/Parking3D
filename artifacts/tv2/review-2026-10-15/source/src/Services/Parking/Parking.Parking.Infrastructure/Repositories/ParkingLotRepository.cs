using Parking.Parking.Application.Interfaces;
using Parking.Parking.Domain;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Parking.Infrastructure.Repositories
{
    public class ParkingLotRepository : IParkingLotRepository
    {
        // Tạm thời Fake dữ liệu cứng để test Postman thay vì gọi DB thật
        public Task<List<ParkingLot>> GetAvailableLotsAsync(string vehicleType, CancellationToken cancellationToken = default)
        {
            var fakeLots = new List<ParkingLot>
        {
            new ParkingLot
            {
                Id = Guid.Parse("11111111-1111-4111-8111-111111111111"),
                Name = "Bãi demo A",
                Latitude = 10.776,
                Longitude = 106.700,
                AvailableSlots = 50,
                Status = "ACTIVE"
            },
            new ParkingLot
            {
                Id = Guid.Parse("22222222-2222-4222-8222-222222222222"),
                Name = "Bãi demo B",
                Latitude = 10.790,
                Longitude = 106.710,
                AvailableSlots = 20,
                Status = "ACTIVE"
            }
        };
            // Lọc dữ liệu giả lập y như thật
            var result = fakeLots
                .Where(p => p.Status == "ACTIVE")
                .Where(p => p.AvailableSlots > 0)
                .ToList();
            return Task.FromResult(result);
        }

    }
}
