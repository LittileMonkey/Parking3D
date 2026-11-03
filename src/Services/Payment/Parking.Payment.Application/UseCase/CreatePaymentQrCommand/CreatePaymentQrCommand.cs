using MediatR;
using Parking.Payment.Application.DTOs;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Payment.Application.UseCase.CreatePaymentQrCommand
{
    /// <summary>
    /// Command tiếp nhận yêu cầu sinh mã VNPay-QR động theo đơn đặt chỗ.
    /// </summary>

    public record CreatePaymentQrCommand(
        Guid BookingId,
        Guid UserId,
        string? IpAddress = null,
        string? IdempotencyKey = null
    ) : IRequest<PaymentQrResultDto>;


}
