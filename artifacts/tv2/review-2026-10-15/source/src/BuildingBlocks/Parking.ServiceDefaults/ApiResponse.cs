using Microsoft.AspNetCore.Http;

namespace Parking.ServiceDefaults;

public sealed record ApiResponse<T>(T? Result, bool IsSuccess, int StatusCode, string Message);

public static class Responses
{
    public static IResult Ok<T>(T value, string message = "Success") =>
        Results.Json(new ApiResponse<T>(value, true, 200, message));

    public static IResult Error(int status, string message) =>
        Results.Json(new ApiResponse<object>(null, false, status, message), statusCode: status);
}

public sealed class ServiceException(int statusCode, string message) : Exception(message)
{
    public int StatusCode { get; } = statusCode;
}
