using Google.Protobuf;
using Parking.Identity.Application.Common.AppException;
using Parking.Identity.Application.Common.Enum;
using Parking.Identity.Application.DTOs.Response;
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
            var statusCode = MapErrorCodeToStatusCode(ex.ErrorCode);
            context.Response.StatusCode = statusCode;
            context.Response.ContentType = "application/json";

            var response = ApiResponse<object>.Failure(
                message: ex.Message,  
                statusCode: statusCode,
                errorCode: ex.ErrorCode
            );
            var jsonResponse = JsonSerializer.Serialize(response);

            await context.Response.WriteAsync(jsonResponse);
        }

        private static int MapErrorCodeToStatusCode(string errorCode) => errorCode switch
        {
            // 404 Not Found
            ErrorCode.AccountNotFound or
            ErrorCode.EmailNotFound or
            ErrorCode.PhoneNotFound or
            ErrorCode.VehicleNotFound or
            ErrorCode.MembershipNotFound or
            ErrorCode.OtpNotFound or
            ErrorCode.ClientIDNotFound => StatusCodes.Status404NotFound,

            // 401 Unauthorized
            ErrorCode.Unauthorized or
            ErrorCode.InvalidCredentials or
            ErrorCode.InvalidToken or
            ErrorCode.TokenExpired or
            ErrorCode.TokenMissing => StatusCodes.Status401Unauthorized,

            // 403 Forbidden
            ErrorCode.Forbidden or
            ErrorCode.AccountLocked or
            ErrorCode.AccountDisabled or
            ErrorCode.AccountInactive or
            ErrorCode.VehicleOwnershipViolation or
            ErrorCode.MembershipUpdateForbidden => StatusCodes.Status403Forbidden,

            // 409 Conflict
            ErrorCode.AccountAlreadyExists or
            ErrorCode.EmailAlreadyExists or
            ErrorCode.PhoneAlreadyExists or
            ErrorCode.VehicleAlreadyExists or
            ErrorCode.MembershipAlreadyExists or
            ErrorCode.AssignmentAlreadyRevoked or
            ErrorCode.VehicleAlreadyDefault => StatusCodes.Status409Conflict,

            // 503 Service Unavailable
            ErrorCode.ServiceUnavailable => StatusCodes.Status503ServiceUnavailable,

            // Default: 400 Bad Request
            _ => StatusCodes.Status400BadRequest
        };

        private async Task HandlerExceptionAsync(HttpContext context, Exception ex)
        {
            context.Response.StatusCode = StatusCodes.Status500InternalServerError;
            context.Response.ContentType = "application/json";

            var response = ApiResponse<object?>.Failure(
                message : "Internal server error occurred",
                statusCode : StatusCodes.Status500InternalServerError,
                errorCode : ErrorCode.InternalServerError
            );

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

            var response = ApiResponse<object>.Failure(
                 message: "Validation failed",
                 statusCode: StatusCodes.Status400BadRequest,
                 errorCode: ErrorCode.InvalidRequest,
                 result: errors
            );

            var jsonResponse = JsonSerializer.Serialize(response);

            await context.Response.WriteAsync(jsonResponse);
        }
    }
}
