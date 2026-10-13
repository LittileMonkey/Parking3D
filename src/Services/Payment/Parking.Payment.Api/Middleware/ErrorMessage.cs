using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Payment.Api.Middleware
{
    public class ErrorMessage
    {
            public string Message { get; set; } = "Đã xảy ra lỗi hệ thống";
            public List<ErrorDetail> ErrorDetails { get; set; } = new();
       
    }
}
