using System.Text.Json;
using Template.Application.Common.Exception;

namespace Template.WebAPI.Middleware;

public class ExceptionMiddleware
{
    // _next đại diện cho phần pipeline phía sau Middleware này
    private readonly RequestDelegate _next;

    public ExceptionMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            // Cho Request đi tiếp:
            // Middleware -> Controller -> Handler
            await _next(context);
        }
        catch (AppException ex)
        {
            context.Response.StatusCode = ex.StatusCode;
            context.Response.ContentType = "application/json";

            var response = new
            {
                code = ex.ErrorCode,
                message = ex.ErrorMessage
            };

            var jsonResponse = JsonSerializer.Serialize(response);

            await context.Response.WriteAsync(jsonResponse);
        }
        catch (Exception ex)
        {
            context.Response.StatusCode = 500;
            context.Response.ContentType = "application/json";

            var responsee = new
            {
                code = 500,
                message = "Internal Server Error"
            };

            var jsonResponse = JsonSerializer.Serialize(responsee);

            await context.Response.WriteAsync(jsonResponse);
        }
    }
}