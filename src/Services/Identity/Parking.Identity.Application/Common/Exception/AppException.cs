using Parking.Identity.Application.Common.Enum;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Identity.Application.Common.AppException
{
    public class AppException : Exception
    {
        public ErrorCode ErrorCode { get; set; }
        public AppException() { }
        public AppException(ErrorCode errorCode, string message) : base(message)
        {
            ErrorCode = errorCode;
        }

    }
}
