using Parking.Identity.Application.Common.AppException;
using System.Text.Json;
using ValidationException = FluentValidation.ValidationException;

namespace Parking.Identity.Api.Middleware
{
    public class GlobalExceptionMiddleware
    {
        private readonly RequestDelegate next;
        public GlobalExceptionMiddleware(RequestDelegate _next)
        {
            this.next = _next;
        }

        public async Task Invoke(HttpContext context)
        {
            try
            {
                await next(context);
            }
            catch (ValidationException ex)
            {
                await HandlerValidationExceptionAsync(context, ex);
            }
            catch (AppException ex)
            {
                await HandlerAppExceptionAsync(context, ex);
            }
            catch (Exception ex)
            {
                await HandlerExceptionAsync(context, ex);
            }
        }

        private async Task HandlerAppExceptionAsync(HttpContext context, AppException ex)
        {
            context.Response.StatusCode = StatusCodes.Status400BadRequest;
            context.Response.ContentType = "application/json";

            var response = new
            {
                code = ex.ErrorCode,
                message = ex.Message,
            };

            var jsonResponse = JsonSerializer.Serialize(response);

            await context.Response.WriteAsync(jsonResponse);

        }

        private async Task HandlerExceptionAsync(HttpContext context, Exception ex)
        {
            context.Response.StatusCode = StatusCodes.Status500InternalServerError;
            context.Response.ContentType = "application/json";

            var response = new
            {
                code = 9999,
                message = "Internal server error"
            };

            await context.Response.WriteAsync(JsonSerializer.Serialize(response));
        }
        private async Task HandlerValidationExceptionAsync(HttpContext context, ValidationException ex)
        {
            context.Response.StatusCode = StatusCodes.Status400BadRequest;
            context.Response.ContentType = "application/json";

            var errors = ex.Errors.Select(error => new
            {
                field = error.PropertyName,
                message = error.ErrorMessage
            });

            var response = new
            {
                code = 1601,
                message = "Validation failed",
                result = errors
            };

            var jsonResponse = JsonSerializer.Serialize(response);

            await context.Response.WriteAsync(jsonResponse);
        }
    }
}
