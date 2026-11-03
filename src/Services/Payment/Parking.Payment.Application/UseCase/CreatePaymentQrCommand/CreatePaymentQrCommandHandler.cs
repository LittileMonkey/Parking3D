using MediatR;
using Parking.Payment.Application.DTOs;
using Parking.Payment.Application.Interfaces;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Payment.Application.UseCase.CreatePaymentQrCommand
{
    /// <summary>
    /// Handler tiếp nhận CreatePaymentQrCommand, điều phối qua PaymentService để sinh URL QR VNPay.
    /// </summary>
    public class CreatePaymentQrCommandHandler : IRequestHandler<CreatePaymentQrCommand, PaymentQrResultDto>
    {
        private readonly IPaymentService _paymentService;

        public CreatePaymentQrCommandHandler(IPaymentService paymentService)
        {
            _paymentService = paymentService;
        }
        public async Task<PaymentQrResultDto> Handle(CreatePaymentQrCommand request, CancellationToken cancellationToken)
        {
            // 1. Chuẩn bị Idempotency-Key (nếu client không gửi thì tự tạo mã duy nhất)
            var idempotencyKey = string.IsNullOrWhiteSpace(request.IdempotencyKey) ? Guid.NewGuid().ToString("N") : request.IdempotencyKey;
            var createRequest = new CreatePaymentRequest(request.BookingId, "VNPAY");
            // 2. Gọi tầng dịch vụ điều phối trung tâm để lấy báo giá, lock chống ghi đè và ký link HMAC-SHA512
            var view = await _paymentService.CreateAsync(
                request.UserId,
                createRequest,
                idempotencyKey,
                cancellationToken,
                request.IpAddress);
            // 3. Đóng gói kết quả trả về cho Client/Kiosk hiển thị QR Code (hạn dùng 5 phút)
            return new PaymentQrResultDto(
                PaymentId: view.Id,
                BookingId: view.BookingId,
                Amount: view.Amount,
                Currency: view.Currency,
                MerchantTxnRef: view.Id.ToString("N"),
                PaymentUrl: view.PaymentUrl ?? string.Empty,
                QrPayload: view.PaymentUrl ?? string.Empty,
                ExpiresAt: DateTimeOffset.UtcNow.AddMinutes(5)
            );
        }
    }
}
