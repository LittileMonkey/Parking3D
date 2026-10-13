using Parking.Parking.Application.Interfaces;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Parking.Infrastructure.Services
{
    // Bắt buộc phải kế thừa IEstimatedPriceService
    public class FakeEstimatedPriceService : IEstimatedPriceService
    {
        public Task<EstimatedPriceResult> CalculateEstimatedFeeAsync(
            Guid lotId, string vehicleType, DateTime startTime, int expectedDurationMinutes)
        {
            // Trả về đại 50.000 VNĐ cho tất cả mọi bãi xe
            var fakeResult = new EstimatedPriceResult
            {
                TotalFee = 50000m, // Ký tự 'm' biểu thị kiểu decimal
                Currency = "VND",
                Details = $"Giá giả lập (Mock) cho đỗ xe {expectedDurationMinutes} phút."
            };

            return Task.FromResult(fakeResult);
        }
    }

}
