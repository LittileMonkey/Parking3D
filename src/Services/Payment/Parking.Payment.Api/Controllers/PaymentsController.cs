using MediatR;
using Microsoft.AspNetCore.Mvc;
using Parking.Payment.Api.Common;
using Parking.Payment.Application.DTOs;
using Parking.Payment.Application.UseCase.CalculateFee;
using Parking.Payment.Application.UseCase.ConfirmCashPayment;
using Parking.Payment.Application.UseCase.GetPaymentStatus;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Payment.Api.Controllers
{
    [ApiController]
    [Route("api/v1/payments")]
    public class PaymentsController : Controller
    {
        private readonly IMediator _mediator;

        public PaymentsController(IMediator mediator)
        {
            _mediator = mediator;
        }

        /// Tra cứu trạng thái thanh toán theo BookingId (API 1 - S2-06)

        [HttpGet("{bookingId:guid}/status")]
        public async Task<IActionResult> GetPaymentStatus(Guid bookingId, CancellationToken cancellationToken)
        {
            var query = new GetPaymentStatusQuery(bookingId);

            // 1. Gửi qua MediatR chạy qua ValidationBehavior và Handler
            var resultDto = await _mediator.Send(query, cancellationToken);

            // 2. Nếu không tìm thấy
            if (resultDto == null)
            {
                var notFoundResponse = ApiResponse<PaymentStatusDto>.Fail(
                    default!,
                    "Payment record not found for the specified booking.", 
                    404);
                return NotFound(notFoundResponse);
            }

            // 3. Bọc DTO vào phong bì ApiResponse chuẩn (y hệt ParkingLotsController)
            var response = ApiResponse<PaymentStatusDto>.Success(
                resultDto,
                "Retrieved payment status successfully.",
                200);
            return Ok(response);
        }


        /// Nhân viên xác nhận thu tiền mặt từ khách hàng (API 2 - S2-06)
        [HttpPost("cash/confirm")]
        public async Task<IActionResult> ConfirmCashPayment([FromBody] ConfirmCashPaymentRequestDto requestDto, CancellationToken cancellationToken)
        {
            // 1. Trích xuất tên nhân viên từ Token (fallback về "staff_01" nếu test qua Postman chưa có Token)
            var staffName = User.Identity?.Name
                              ?? User.FindFirst("name")?.Value
                              ?? User.FindFirst("sub")?.Value
                              ?? "staff_01";

            // 2. Chuyển đổi DTO thành MediatR Command
            var command = new ConfirmCashPaymentCommand(
                           requestDto.BookingId, // hoặc requestDto.BookingId tùy theo file DTO của bạn
                           requestDto.StaffReason,
                           requestDto.Version,
                           staffName
                       );

            // 3. Gửi Command qua MediatR (tự động chạy qua Validator kiểm tra dữ liệu)
            var resultDto = await _mediator.Send(command, cancellationToken);


            // 4. Bọc kết quả vào phong bì ApiResponse chuẩn 200 OK theo tài liệu thiết kế S2-06
            var response = ApiResponse<ConfirmCashPaymentResultDto>.Success(resultDto, "CASH payment confirmed. Receipt is being generated.", 200);

            return Ok(response);
        }

        /// <summary>
        /// Ước tính hoặc tính toán tiền cước đỗ xe theo Block 15p, Giờ cao điểm 1.2x, Trần ngày và Chiết khấu Gold Star
        /// </summary>
        [HttpPost("calculate-fee")]
        public async Task<IActionResult> CalculateFee([FromBody] CalculateFeeRequestDto requestDto, CancellationToken cancellationToken)
        {
            // 1. Chuyển đổi từ DTO sang CQRS Query
            var query = new CalculateFeeQuery(
                requestDto.ParkingLotId,
                requestDto.EntryTime,
                requestDto.ExitTime,
                requestDto.IsGoldStarMember,
                requestDto.VehicleType
            );
            // 2. Gửi qua MediatR (tự động chạy qua CalculateFeeQueryValidator để kiểm tra tính hợp lệ)
            var resultDto = await _mediator.Send(query, cancellationToken);

            // 3. Bọc kết quả vào phong bì ApiResponse chuẩn 200 OK của dự án
            var response = ApiResponse<FeeCalculationResultDto>.Success(
                resultDto, "Calculated parking fee successfully.",200);
            return Ok(response);


        }

    }
}
