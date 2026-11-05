using MediatR;
using Microsoft.AspNetCore.Authorization;
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


        /// <summary>
        /// Nhân viên xác nhận thu tiền mặt từ khách hàng (API 4 - SCRUM-95 & S3-06)
        /// </summary>
        [HttpPost("cash/confirm")]
        public async Task<IActionResult> ConfirmCashPayment([FromBody] ConfirmCashPaymentRequestDto requestDto, CancellationToken cancellationToken)
        {
            // 1. Trích xuất User ID (UUID) của nhân viên từ JWT Claims hoặc Header
            var staffClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                          ?? User.FindFirst("sub")?.Value
                          ?? User.FindFirst("id")?.Value
                          ?? Request.Headers["X-User-Id"].FirstOrDefault();
            // Nếu test nội bộ không có token, fallback về Staff ID mặc định trong Seed DB
            var staffId = Guid.TryParse(staffClaim, out var parsedGuid)
                ? parsedGuid.ToString()
                : "22222222-2222-2222-2222-222222222222";
            // 2. Chuyển đổi DTO thành MediatR Command mang theo ID thật của nhân viên
            var command = new ConfirmCashPaymentCommand(
                requestDto.BookingId,
                requestDto.StaffReason,
                requestDto.Version,
                staffId
            );
            // 3. Gửi Command qua MediatR (chạy qua Validator và Handler)
            var resultDto = await _mediator.Send(command, cancellationToken);
            // 4. Bọc kết quả vào phong bì ApiResponse chuẩn 200 OK
            var response = ApiResponse<ConfirmCashPaymentResultDto>.Success(
                resultDto,
                "CASH payment confirmed. Receipt is being generated.",
                200);
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
        /// Tra cứu / in hóa đơn điện tử (E-Receipt) kèm kiểm tra quyền Customer chính chủ hoặc Staff bãi xe (API 5 - SCRUM-72 & S3-06)
        /// </summary>
        [Authorize]
        [HttpGet("{paymentId:guid}/receipt")]
        public async Task<IActionResult> GetPaymentReceipt(Guid paymentId, CancellationToken cancellationToken)
        {
            // 1. Trích xuất User ID từ JWT Token (sub, NameIdentifier, id) hoặc Header X-User-Id
            var userClaim = User.FindFirst("sub")?.Value
                         ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                         ?? User.FindFirst("id")?.Value
                         ?? Request.Headers["X-User-Id"].FirstOrDefault();
            // 2. Chặn đứng request không hợp lệ: Tuyệt đối KHÔNG cấp fallback ID
            if (!Guid.TryParse(userClaim, out var requestingUserId) || requestingUserId == Guid.Empty)
            {
                return Unauthorized(ApiResponse<EReceiptDto>.Fail(
                    default!,
                    "Authentication required. Invalid or missing user token.",
                    401));
            }
            // 3. Gửi sang MediatR với UserId thật của người gọi
            var query = new GetPaymentReceiptQuery(paymentId, requestingUserId);
            var resultDto = await _mediator.Send(query, cancellationToken);
            // 4. Nếu không tìm thấy
            if (resultDto == null)
            {
                var notFoundResponse = ApiResponse<EReceiptDto>.Fail(
                    default!,
                    "Payment receipt not found.",
                    404);
                return NotFound(notFoundResponse);
            }
            // 5. Trả về kết quả đóng gói chuẩn ApiResponse 200 OK
            var response = ApiResponse<EReceiptDto>.Success(
                resultDto,
                "Electronic receipt retrieved successfully.",
                200);
            return Ok(response);
        }


    }
}
