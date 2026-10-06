namespace ParkingSystem.Application.Common.Models;

/// <summary>
/// Khung chuẩn hóa phản hồi API (API Response Envelope) theo chuẩn BaseLine V4
/// </summary>
/// <typeparam name="T">Kiểu dữ liệu của kết quả trả về</typeparam>
public class ApiResponse<T>
{
    public T? Result { get; set; }
    public bool IsSuccess { get; set; }
    public int StatusCode { get; set; }
    public string Message { get; set; } = string.Empty;

    public static ApiResponse<T> Success(T result, string message = "Success", int statusCode = 200) =>
        new() { Result = result, IsSuccess = true, StatusCode = statusCode, Message = message };

    public static ApiResponse<T> Failure(string message, int statusCode = 400) =>
        new() { Result = default, IsSuccess = false, StatusCode = statusCode, Message = message };
}
