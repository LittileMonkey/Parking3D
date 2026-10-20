using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Identity.Application.Common.Interface
{
    public interface IEmailService
    {
        Task SendPasswordResetOtpAsync(string email, string otp, CancellationToken cancellationToken);
    }
}
