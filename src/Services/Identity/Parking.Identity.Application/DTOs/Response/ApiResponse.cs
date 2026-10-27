namespace Parking.Identity.Application.DTOs.Response
{
    public class ApiResponse<T>
    {
        public T? Result { get; set; }
        public bool IsSuccess { get; set; }
        public int StatusCode { get; set; }
        public string Message { get; set; } = string.Empty;
        public string? ErrorCode { get; set; }


        public ApiResponse() { }

        public ApiResponse(bool isSuccess, int statusCode, string message, T? result = default, string? errorCode = null)
        {
            Result = result;
            IsSuccess = isSuccess;
            StatusCode = statusCode;
            Message = message;
            ErrorCode = errorCode;
        }

        public static ApiResponse<T> Success(T? result, string message, int statusCode = 200)
        {
            return new ApiResponse<T>(true, statusCode, message, result);
        }

        public static ApiResponse<T> Failure(string message, int statusCode, string? errorCode, T? result = default)
        {
            return new ApiResponse<T>(false, statusCode, message, result, errorCode);
        }


    }
}
