using Parking.Identity.Application.Common.Enum;

namespace Parking.Identity.Application.Common.AppException
{
    public class AppException : Exception
    {
        public string ErrorCode { get; set; } = string.Empty;
        public AppException() { }
        public AppException(string errorCode, string message) : base(message)
        {
            ErrorCode = errorCode;
        }

    }
}
