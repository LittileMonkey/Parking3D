using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Identity.Application.Common.Interface
{
    public interface IOtpService
    {
        string GenerateOtp();
        string HashOtp(string otp);
        bool VerifyOtp(string otp, string otpHash);
    }
}
