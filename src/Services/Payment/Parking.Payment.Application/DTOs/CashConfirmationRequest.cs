using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Payment.Application.DTOs
{
    /// <summary>
    /// Yêu cầu nhân viên bãi đỗ xác nhận đã thu tiền mặt từ khách.
    /// </summary>
    public sealed record CashConfirmationRequest(int Version, string Reason);

}
