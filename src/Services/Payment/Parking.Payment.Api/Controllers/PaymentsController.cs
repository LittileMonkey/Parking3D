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
        [Authorize]
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
        /// Yêu cầu: Bắt buộc phải có Token của Nhân viên bãi xe
        /// </summary>
        [Authorize]
        [HttpPost("cash/confirm")]
        public async Task<IActionResult> ConfirmCashPayment([FromBody] ConfirmCashPaymentRequestDto requestDto, CancellationToken cancellationToken)
        {
            // 1. Trích xuất User ID của nhân viên từ Token thật
            var staffClaim = User.FindFirst("sub")?.Value
                          ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                          ?? User.FindFirst("id")?.Value;
                          
            // 2. Chặn đứng nếu không có token hợp lệ (Zero Trust - Không dùng ID giả)
            if (!Guid.TryParse(staffClaim, out var parsedStaffGuid) || parsedStaffGuid == Guid.Empty)
            {
                return Unauthorized(ApiResponse<ConfirmCashPaymentResultDto>.Fail(
                    default!,
                    "Authentication required. Invalid or missing staff token.",
                    401));
            }
            // 3. Gửi Command qua MediatR với ID nhân viên thật
            var command = new ConfirmCashPaymentCommand(
                requestDto.BookingId,
                requestDto.StaffReason,
                requestDto.Version,
                parsedStaffGuid.ToString()
            );
            var resultDto = await _mediator.Send(command, cancellationToken);
            var response = ApiResponse<ConfirmCashPaymentResultDto>.Success(
                resultDto,
                "CASH payment confirmed. Receipt is being generated.",
                200);
            return Ok(response);
        }


        /// <summary>
        /// Ước tính hoặc tính toán tiền cước đỗ xe theo Block 15p, Giờ cao điểm 1.2x, Trần ngày và Chiết khấu Gold Star.
        /// Đã tách riêng ngày và giờ; nếu để trống ngày giờ sẽ tự động lấy HÔM NAY theo múi giờ Việt Nam (GMT+7).
        /// </summary>
        [HttpPost("calculate-fee")]
        public async Task<IActionResult> CalculateFee([FromBody] CalculateFeeRequestDto requestDto, CancellationToken cancellationToken)
        {
            // 1. Xác định mốc thời gian hiện tại theo Múi giờ Việt Nam (GMT+7)
            var vnOffset = TimeSpan.FromHours(7);
            var nowVn = DateTimeOffset.UtcNow.ToOffset(vnOffset);

            // 2. Xử lý giá trị mặc định nếu Client không truyền
            var targetStartDate = requestDto.Date ?? DateOnly.FromDateTime(nowVn.DateTime);
            var targetStartTime = requestDto.StartTime ?? TimeOnly.FromDateTime(nowVn.DateTime);
            var targetEndTime = requestDto.EndTime ?? targetStartTime.AddHours(1);

            // Nếu không truyền ngày ra: nếu giờ ra nhỏ hơn giờ vào thì tự hiểu là gửi qua đêm (cộng 1 ngày)
            var targetEndDate = requestDto.EndDate
                             ?? (targetEndTime < targetStartTime ? targetStartDate.AddDays(1) : targetStartDate);

            // 3. Ghép ngày và giờ thành thời điểm hoàn chỉnh (Local Time GMT+7)
            var startDateTimeLocal = targetStartDate.ToDateTime(targetStartTime);
            var endDateTimeLocal = targetEndDate.ToDateTime(targetEndTime);

            // 4. Chuyển đổi an toàn sang DateTimeOffset UTC cho lõi tính cước
            var entryTimeUtc = new DateTimeOffset(startDateTimeLocal, vnOffset).ToUniversalTime();
            var exitTimeUtc = new DateTimeOffset(endDateTimeLocal, vnOffset).ToUniversalTime();

            // 5. Khởi tạo Query CQRS gửi qua MediatR
            var query = new CalculateFeeQuery(
                requestDto.ParkingLotId,
                entryTimeUtc,
                exitTimeUtc,
                requestDto.IsGoldStarMember,
                requestDto.VehicleType
            );

            // 6. Gửi qua MediatR chạy qua ValidationBehavior và CalculateFeeQueryHandler
            var result = await _mediator.Send(query, cancellationToken);
            var response = ApiResponse<FeeCalculationResultDto>.Success(
                result,
                "Fee calculation completed successfully.",
                200
            );

            return Ok(response);
        }

        /// <summary>
        /// Sinh mã VNPay-QR thanh toán động theo đơn đặt gửi xe (API 1 - SCRUM-72)
        /// Yêu cầu: Bắt buộc khách hàng phải đăng nhập
        /// </summary>
        [Authorize]
        [HttpPost("vnpay/create-qr")]
        public async Task<IActionResult> CreatePaymentQr([FromBody] CreatePaymentQrRequestDto requestDto, CancellationToken cancellationToken)
        {
            // 1. Trích xuất UserId từ Token thật của khách
            var userIdClaim = User.FindFirst("sub")?.Value
                              ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                              ?? User.FindFirst("id")?.Value;
                              

            // 2. Chặn đứng nếu chưa đăng nhập
            if (!Guid.TryParse(userIdClaim, out var userId) || userId == Guid.Empty)
            {
                return Unauthorized(ApiResponse<PaymentQrResultDto>.Fail(
                    default!,
                    "Authentication required. Please login to generate payment QR.",
                    401));
            }
            var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";

            var idempotencyKey = Request.Headers["Idempotency-Key"].ToString();
            // Nếu Client không truyền Header Idempotency-Key -> Fallback an toàn gắn chặt với BookingId
            if (string.IsNullOrWhiteSpace(idempotencyKey))
            {
                idempotencyKey = $"vnpay-qr:{requestDto.BookingId}";
            }
            var command = new CreatePaymentQrCommand(
                           BookingId: requestDto.BookingId,
                           UserId: userId,
                           IpAddress: ipAddress,
                           IdempotencyKey: idempotencyKey
                        );

            var resultDto = await _mediator.Send(command, cancellationToken);

            var response = ApiResponse<PaymentQrResultDto>.Success(resultDto, "Dynamic VNPay-QR generated successfully. Valid for 5 minutes.",
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
                         ?? User.FindFirst("id")?.Value;
                         
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
