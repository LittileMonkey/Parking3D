using FluentValidation;
using Parking.Parking.Application.Exceptions;
using Parking.ServiceDefaults;

namespace Parking.Parking.Api.Middleware;

// Đổi lỗi Application thành HTTP envelope; lỗi hạ tầng do UseParkingDefaults xử lý.
public sealed class ExceptionHandlingMiddleware(RequestDelegate next)
{
    /// <summary>Đổi lỗi validation, không tìm thấy, thiếu quyền hoặc xung đột của Application thành HTTP envelope chuẩn.</summary>
    public async Task InvokeAsync(HttpContext context)
    {
        try { await next(context); }
        catch (Exception exception) when (!context.Response.HasStarted &&
            exception is ValidationException or NotFoundException or ForbiddenAccessException or ConflictException)
        {
            var status = exception switch
            {
                ValidationException => 400,
                NotFoundException => 404,
                ForbiddenAccessException => 403,
                ConflictException => 409,
                _ => 500
            };
            context.Response.StatusCode = status;
            await context.Response.WriteAsJsonAsync(new ApiResponse<object>(null, false, status, exception.Message),
                cancellationToken: context.RequestAborted);
        }

    }
}
