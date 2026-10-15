using FluentValidation;
using Parking.Parking.Application.Exceptions;
using Parking.ServiceDefaults;

namespace Parking.Parking.Api.Middleware;

// Application failures are handled here; infrastructure failures stay in UseParkingDefaults.
public sealed class ExceptionHandlingMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try { await next(context); }
        catch (Exception exception) when (!context.Response.HasStarted &&
            exception is ValidationException or NotFoundException or ForbiddenAccessException)
        {
            var status = exception switch
            {
                ValidationException => 400,
                NotFoundException => 404,
                _ => 403
            };
            context.Response.StatusCode = status;
            await context.Response.WriteAsJsonAsync(new ApiResponse<object>(null,false,status,exception.Message),
                cancellationToken: context.RequestAborted);
        }
    }
}
