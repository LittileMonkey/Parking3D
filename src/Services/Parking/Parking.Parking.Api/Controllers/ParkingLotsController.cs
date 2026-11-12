using MediatR;
using Microsoft.AspNetCore.Mvc;
using Parking.Parking.Application.DTOs;
using Parking.Parking.Application.Features.ParkingLots.Queries;
using Parking.ServiceDefaults;

namespace Parking.Parking.Api.Controllers
{
    [ApiController]
    [Route("api/v1/parking-lots")] // Đúng chuẩn URL: /api/v1/parking-lots
    public class ParkingLotsController : ControllerBase
    {
        private readonly IMediator _mediator;
        // "Tiêm" MediatR vào Controller
        public ParkingLotsController(IMediator mediator)
        {
            _mediator = mediator;
        }
        // Định nghĩa Endpoint GET: /api/v1/parking-lots/search
        [HttpGet("search")]
        public async Task<IActionResult> Search([FromQuery] SearchParkingLotsQuery query, CancellationToken cancellationToken)
        {
            // 1. Nhờ MediatR bắn cái Query này vào đường ống (Pipeline).
            // Pipeline sẽ TỰ ĐỘNG gọi file Validator kiểm tra lỗi (Báo 400 nếu có lỗi).
            // Nếu qua ải Validator, Pipeline tự động dẫn tiếp vào file Handler để chạy thuật toán.
            var resultDto = await _mediator.Send(query, cancellationToken);
            // 2. Bọc kết quả DTO vào "lớp vỏ" chuẩn của công ty (ApiResponse)
            var response = new ApiResponse<SearchParkingLotsResultDto>(resultDto, true, 200, "Search completed successfully.");
            // 3. Trả về HTTP 200 OK
            return Ok(response);
        }

        // Endpoint GET: /api/v1/parking-lots/{lotId}/availability
        /// <summary>Nhận bộ lọc tra cứu và trả tình trạng ô đỗ công khai; không trả dữ liệu cá nhân khách.</summary>
        [HttpGet("{lotId:guid}/availability")]
        public async Task<IActionResult> GetAvailability(
                [FromRoute] Guid lotId,
                [FromQuery] DateTimeOffset? startTime,
                [FromQuery] DateTimeOffset? endTime,
                [FromQuery] string? vehicleType,
                [FromQuery] Guid? levelId,
                CancellationToken cancellationToken)
        {
            var query = new GetLotAvailabilityQuery
            {
                LotId = lotId,
                StartTime = startTime,
                EndTime = endTime,
                VehicleType = vehicleType,
                LevelId = levelId
            };
            var result = await _mediator.Send(query, cancellationToken);
            return Ok(new ApiResponse<LotAvailabilityDto>(result, true, 200, "Lot availability retrieved successfully."));
        }

        /// <summary>Lấy chi tiết thông tin bãi đỗ xe theo ID.</summary>
        [HttpGet("{lotId:guid}")]
        public async Task<IActionResult> GetById([FromRoute] Guid lotId, CancellationToken cancellationToken)
        {
            var result = await _mediator.Send(new GetParkingLotDetailQuery(lotId), cancellationToken);
            return Ok(new ApiResponse<ParkingLotDetailDto>(result, true, 200, "Lấy thông tin bãi đỗ xe thành công."));
        }

        /// <summary>Lấy toàn bộ cây cấu trúc không gian 3D của bãi xe (Level -> Zone -> Slot kèm tọa độ 3D) có hỗ trợ Cache.</summary>
        [HttpGet("{lotId:guid}/layout")]
        public async Task<IActionResult> GetLayout([FromRoute] Guid lotId, CancellationToken cancellationToken)
        {
            var result = await _mediator.Send(new GetLotLayout3DQuery(lotId), cancellationToken);
            return Ok(new ApiResponse<LotLayout3DDto>(result, true, 200, "Lấy sơ đồ cấu trúc không gian 3D thành công."));
        }
    }
}