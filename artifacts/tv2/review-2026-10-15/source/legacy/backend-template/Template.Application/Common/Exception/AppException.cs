using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Template.Application.Common.Enum;

namespace Template.Application.Common.Exception
{
    public class AppException : System.Exception
    {
        public int ErrorCode { get; set; }
        public string? ErrorMessage { get; set; }
        public int StatusCode { get; set; }

        public AppException(int errorCode, string? errorMessage, int statusCode) : base(errorMessage)
        {
            ErrorCode = errorCode;
            ErrorMessage = errorMessage;
            StatusCode = statusCode;
        }

    }
}
