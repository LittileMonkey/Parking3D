using System.Text.Json.Serialization;

namespace Parking.Payment.Api.Middleware
{
    public class ErrorDetail
    {
        // Khi gán null, JsonIgnore sẽ tự động BỎ HẲN trường ErrorMessage khỏi JSON trả về
        [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
        public string? ErrorMessage { get; set; } = null;
        public string ErrorCode { get; set; } = string.Empty;
        public string ErrorField { get; set; } = string.Empty;
    }
}