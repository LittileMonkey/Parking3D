using MediatR;
using Microsoft.AspNetCore.Mvc;
using Parking.Payment.Api.Common;
using Parking.Payment.Application.DTOs;
using Parking.Payment.Application.UseCase.CalculateFee;
using Parking.Payment.Application.UseCase.ConfirmCashPayment;
using Parking.Payment.Application.UseCase.CreatePaymentQrCommand;
using Parking.Payment.Application.UseCase.GetPaymentReceipt;
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

        /// <summary>
        /// Sinh mã VNPay-QR thanh toán động theo đơn đặt gửi xe (API 1 - SCRUM-72)
        /// </summary>
        [HttpPost("vnpay/create-qr")]
        public async Task<IActionResult> CreatePaymentQr([FromBody] CreatePaymentQrRequestDto requestDto, CancellationToken cancellationToken)
        {
            // 1. Trích xuất UserId từ Token hoặc Header X-User-Id (fallback về customer01 mặc định: 11111111-1111-1111-1111-111111111111)
            var userIdClaim = User.FindFirst("sub")?.Value 
                              ?? User.FindFirst("id")?.Value 
                              ?? Request.Headers["X-User-Id"].FirstOrDefault();
            var userId = Guid.TryParse(userIdClaim, out var parsedGuid) ? parsedGuid : Guid.Parse("11111111-1111-1111-1111-111111111111");

            // 2. Lấy IP kết nối của khách hàng và Idempotency-Key từ Request Header
            var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";
            var idempotencyKey = Request.Headers["Idempotency-Key"].ToString();

            // 3. Khởi tạo Command gửi qua MediatR
            var command = new CreatePaymentQrCommand(
               BookingId: requestDto.BookingId,
               UserId: userId,
               IpAddress: ipAddress,
               IdempotencyKey: string.IsNullOrWhiteSpace(idempotencyKey) ? null : idempotencyKey
            );

            // 4. MediatR tự động kích hoạt Validator kiểm tra dữ liệu và chuyển tới CreatePaymentQrCommandHandler
            var resultDto = await _mediator.Send(command, cancellationToken);

            // 5. Bọc kết quả vào phong bì ApiResponse chuẩn 200 OK
            var response = ApiResponse<PaymentQrResultDto>.Success(
                resultDto,
                "Dynamic VNPay-QR generated successfully. Valid for 5 minutes.",
                200);


            return Ok(response);
        }
        /// <summary>
        /// Tra cứu hóa đơn điện tử (E-Receipt) kèm mã xác thực số theo PaymentId (API 5 - SCRUM-72)
        /// </summary>
        [HttpGet("{paymentId:guid}/receipt")]
        public async Task<IActionResult> GetPaymentReceipt(Guid paymentId, CancellationToken cancellationToken)
        {
            var query = new GetPaymentReceiptQuery(paymentId);
            // 1. Gửi qua MediatR chạy qua ValidationBehavior và Handler
            var resultDto = await _mediator.Send(query, cancellationToken);
            // 2. Nếu không tìm thấy bản ghi thanh toán hoặc đơn chưa thanh toán thành công
            if (resultDto == null)
            {
                var notFoundResponse = ApiResponse<EReceiptDto>.Fail(
                    default!,
                    "Payment receipt not found or payment is not completed yet.",
                    404);
                return NotFound(notFoundResponse);
            }
            // 3. Bọc kết quả vào phong bì ApiResponse chuẩn 200 OK
            var response = ApiResponse<EReceiptDto>.Success(
                resultDto,
                "Electronic receipt retrieved successfully.",
                200);
            return Ok(response);
        }


    }
}
