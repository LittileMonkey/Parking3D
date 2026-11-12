namespace Parking.Payment.Api.Middleware
{
    public class ErrorDetail
    {
        public string ErrorMessage { get; set; } = string.Empty;
        public string ErrorCode { get; set; } = string.Empty;
        public string ErrorField { get; set; } = string.Empty;
    }
}