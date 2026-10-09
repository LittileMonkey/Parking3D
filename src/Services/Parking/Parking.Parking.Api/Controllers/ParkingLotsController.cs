using MediatR;
using Microsoft.AspNetCore.Mvc;
using Parking.Parking.Api.Common;
using Parking.Parking.Application.DTOs;
using Parking.Parking.Application.Features.ParkingLots.Queries;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;


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
        public async Task<IActionResult> Search([FromQuery] SearchParkingLotsQuery query)
        {
            // 1. Nhờ MediatR bắn cái Query này vào đường ống (Pipeline).
            // Pipeline sẽ TỰ ĐỘNG gọi file Validator kiểm tra lỗi (Báo 400 nếu có lỗi).
            // Nếu qua ải Validator, Pipeline tự động dẫn tiếp vào file Handler để chạy thuật toán.
            var resultDto = await _mediator.Send(query);
            // 2. Bọc kết quả DTO vào "lớp vỏ" chuẩn của công ty (ApiResponse)
            var response = new ApiResponse<SearchParkingLotsResultDto>(resultDto, "Search completed successfully.");
            // 3. Trả về HTTP 200 OK
            return Ok(response);
        }
    }
}
