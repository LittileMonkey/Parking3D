using MediatR;
using Parking.Parking.Application.DTOs;
using Parking.Parking.Application.Interfaces;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Parking.Application.Features.ParkingLots.Queries
{
    public class SearchParkingLotsQueryHandler : IRequestHandler<SearchParkingLotsQuery, SearchParkingLotsResultDto>
    {
        private readonly IParkingLotRepository _repository;
        private readonly IEstimatedPriceService _priceService;
        // Sử dụng Dependency Injection để lấy Database và Service tính giá
        public SearchParkingLotsQueryHandler(IParkingLotRepository repository, IEstimatedPriceService priceService)
        {
            _repository = repository;
            _priceService = priceService;
        }
        public async Task<SearchParkingLotsResultDto> Handle(SearchParkingLotsQuery request, CancellationToken cancellationToken)
        {
            // 1. Kéo danh sách bãi xe HỢP LỆ từ Database lên (Đang Active, đúng loại xe, chưa Full)
            // Việc lọc Full/Active/Maintenance sẽ được Database làm giúp ở bên trong hàm này
            var lots = await _repository.GetAvailableLotsAsync(request.VehicleType, cancellationToken);
            var resultItems = new List<ParkingLotItemDto>();
            // 2. Chạy vòng lặp tính Khoảng cách và Tính giá cho TỪNG bãi xe
            foreach (var lot in lots)
            {
                // Tính khoảng cách Haversine (Chỉ tính nếu khách có bật GPS)
                double distance = 0;
                if (request.Latitude.HasValue && request.Longitude.HasValue)
                {
                    distance = CalculateHaversine(request.Latitude.Value, request.Longitude.Value, lot.Latitude, lot.Longitude);
                }
                // Gọi (Fake) Service tính giá cho TOÀN BỘ thời lượng đỗ
                var pricing = await _priceService.CalculateEstimatedFeeAsync(
                    lot.Id,
                    request.VehicleType,
                    request.StartTime ?? DateTime.UtcNow,
                    request.ExpectedDuration);
                // Gom dữ liệu vào DTO
                resultItems.Add(new ParkingLotItemDto
                {
                    ParkingLotId = lot.Id,
                    Name = lot.Name,
                    Latitude = lot.Latitude,
                    Longitude = lot.Longitude,
                    DistanceKm = Math.Round(distance, 2), // Làm tròn 2 chữ số (VD: 1.25 km)
                    AvailableSlots = lot.AvailableSlots,
                    OperatingStatus = lot.Status,
                    EstimatedPricing = new EstimatedPricingDto
                    {
                        ExpectedDurationMinutes = request.ExpectedDuration,
                        EstimatedTotalFee = pricing.TotalFee,
                        Currency = pricing.Currency,
                        BillingDetails = pricing.Details
                    }
                });
            }
            // 3. Sắp xếp (Sort) theo yêu cầu của khách hàng
            if (request.SortBy.Equals("NEAREST", StringComparison.OrdinalIgnoreCase))
            {
                // Sắp xếp TĂNG DẦN theo khoảng cách (Gần nhất đứng đầu), và chỉ lấy 10 bãi
                resultItems = resultItems.OrderBy(x => x.DistanceKm).Take(10).ToList();
            }
            else if (request.SortBy.Equals("CHEAPEST", StringComparison.OrdinalIgnoreCase))
            {
                // Sắp xếp TĂNG DẦN theo Giá tiền (Rẻ nhất đứng đầu), và chỉ lấy 10 bãi
                resultItems = resultItems.OrderBy(x => x.EstimatedPricing.EstimatedTotalFee).Take(10).ToList();
            }
            // 4. Đóng gói trả về cho Frontend
            return new SearchParkingLotsResultDto
            {
                TotalCount = resultItems.Count,
                Items = resultItems
            };
        }
        // Công thức lượng giác Haversine tính khoảng cách đường chim bay siêu tốc
        private double CalculateHaversine(double lat1, double lon1, double lat2, double lon2)
        {
            var R = 6371d; // Bán kính Trái Đất (Km)
            var dLat = (lat2 - lat1) * Math.PI / 180.0;
            var dLon = (lon2 - lon1) * Math.PI / 180.0;
            var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                    Math.Cos(lat1 * Math.PI / 180.0) * Math.Cos(lat2 * Math.PI / 180.0) *
                    Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
            var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
            return R * c;
        }
    }
}
