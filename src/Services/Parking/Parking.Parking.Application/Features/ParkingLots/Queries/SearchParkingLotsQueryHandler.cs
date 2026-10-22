using MediatR;
using Parking.Parking.Application.DTOs;
using Parking.Parking.Application.Interfaces;
using Parking.Parking.Domain;
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
                    var distanceInMeters = SearchMath.Haversine(
                        request.Latitude.Value,
                        request.Longitude.Value,
                        lot.Latitude,
                        lot.Longitude);
                    distance = distanceInMeters / 1000.0;
                }
                var pricing = await _priceService.CalculateEstimatedFeeAsync(
                    lot.Id,
                    request.VehicleType,
                    request.StartTime ?? DateTime.UtcNow,
                    request.ExpectedDuration);
                // Gom dữ liệu vào DTO
                resultItems.Add(new ParkingLotItemDto
                {
                    ParkingLotId = lot.Id,
                    Code = lot.Code,
                    Name = lot.Name,
                    Address = lot.Address,
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
        
    }
}
