using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Identity.Application.Common.Enum
{
    public enum ForgotPasswordStatus
    {
        Success,          // Đã tạo OTP và gửi email thành công
        UserNotFound,     // Không tìm thấy tài khoản với email này (xử lý ngầm)
        EmailSendFailed   // Lỗi khi gửi email (nếu có catch exception gửi mail)
    }
}
