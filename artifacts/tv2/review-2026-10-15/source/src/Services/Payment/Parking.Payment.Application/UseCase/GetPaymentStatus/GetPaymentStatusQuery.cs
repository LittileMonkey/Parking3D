using MediatR;
using Parking.Payment.Application.DTOs;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Payment.Application.UseCase.GetPaymentStatus
{
    public record GetPaymentStatusQuery(Guid BookingId) : IRequest<PaymentStatusDto?>;

}
