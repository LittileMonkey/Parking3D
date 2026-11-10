using FluentValidation;
using Parking.ServiceDefaults;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Grpc.Core;


namespace Parking.Payment.Api.Middleware
{
    // Bộ phân loại và xử lý Exception theo chuẩn Mentor
    public class ErrorExceptionHandler
    {
        private readonly Dictionary<Type, Func<Exception, ErrorMessage>> ExceptionHandling;
        public ErrorExceptionHandler()
        {
            this.ExceptionHandling = new Dictionary<Type, Func<Exception, ErrorMessage>>
            {
                { typeof(ValidationException), HandleValidationException },
                { typeof(ServiceException), HandleServiceException },
                { typeof(NotImplementedException), HandleNotImplementedException },
                { typeof(Exception), HandleGenericException }
            };
        }
        public (int, ErrorMessage) HandleException(Exception exception)
        {
            var statusCode = GetStatusCode(exception);
            var errorMessage = new ErrorMessage();
            if (this.ExceptionHandling.TryGetValue(exception.GetType(), out var handler))
            {
                errorMessage = handler(exception);
            }
            else
            {
                errorMessage = HandleGenericException(exception);
            }
            return (statusCode, errorMessage);
        }
        private static int GetStatusCode(Exception exception)
        {
            return exception switch
            {
                ValidationException => StatusCodes.Status400BadRequest,
                ServiceException se => se.StatusCode,
                NotImplementedException => StatusCodes.Status501NotImplemented,
                _ => StatusCodes.Status500InternalServerError
            };
        }
        private ErrorMessage HandleValidationException(Exception exception)
        {
            var validationException = exception as ValidationException;
            ArgumentNullException.ThrowIfNull(validationException);
            var listError = validationException.Errors.Select(error => new ErrorDetail
            {
                ErrorMessage = error.ErrorMessage,
                ErrorCode = error.ErrorCode,
                ErrorField = error.PropertyName
            }).ToList();
            return new ErrorMessage
            {
                Message = "Dữ liệu không hợp lệ.",
                ErrorDetails = listError
            };
        }
        private ErrorMessage HandleNotImplementedException(Exception exception)
        {
            return new ErrorMessage
            {
                Message = "Chức năng chưa được triển khai.",
                ErrorDetails = new List<ErrorDetail>
                {
                    new()
                    {
                        ErrorMessage = exception.Message,
                        ErrorCode = "NotImplemented",
                        ErrorField = string.Empty
                    }
                }
            };
        }
        private ErrorMessage HandleGenericException(Exception exception)
        {
            return new ErrorMessage
            {
                Message = "Đã xảy ra lỗi hệ thống.",
                ErrorDetails = new List<ErrorDetail>
                {
                    new()
                    {
                        ErrorMessage = exception.Message,
                        ErrorCode = "InternalServerError",
                        ErrorField = exception.Source ?? string.Empty
                    }
                }
            };
        }

        private ErrorMessage HandleServiceException(Exception exception)
        {
            var serviceException = (ServiceException)exception;
            // 1. Đặt tên mã lỗi ngắn gọn, có nghĩa thay vì dùng HTTP_409
            var errorCode = serviceException.StatusCode switch
            {
                400 => "INVALID_REQUEST",
                403 => "FORBIDDEN",
                404 => "BOOKING_NOT_FOUND",
                409 when serviceException.Message.Contains("Expired") || serviceException.Message.Contains("qua han")
                    => "BOOKING_EXPIRED",
                409 => "BOOKING_STATUS_CONFLICT",
                422 => "CONCURRENCY_ERROR",
                503 => "SERVICE_UNAVAILABLE",
                _ => "PAYMENT_ERROR"
            };
            // 2. Xác định biến đang bị lỗi (ở trường hợp này là bookingId)
            var errorField = (serviceException.StatusCode == 404 || serviceException.StatusCode == 409)
                ? "bookingId"
                : string.Empty;
            return new ErrorMessage
            {
                Message = serviceException.Message,
                ErrorDetails = new List<ErrorDetail>
                {
                    new()
                    {
                        ErrorMessage = null,        // Gán null để không bị lặp lại dòng chữ trên
                        ErrorCode = errorCode,       // Ví dụ: "BOOKING_EXPIRED"
                        ErrorField = errorField      // Gán: "bookingId"
                    }
                }
            };
        }
    }


    public class ExceptionHandlingMiddleware : IMiddleware
    {
        public async Task InvokeAsync(HttpContext context, RequestDelegate next)
        {
            try
            {
                await next(context);
            }
            catch (Exception ex)
            {
                var exceptionHandle = new ErrorExceptionHandler();
                var (status, errorMessage) = exceptionHandle.HandleException(ex);
                context.Response.ContentType = "application/json";
                context.Response.StatusCode = status;

                var response = new
                {
                    isSuccess = false,
                    statusCode = status,
                    message = errorMessage.Message,
                    result = errorMessage.ErrorDetails
                };
                // Cấu hình NamingPolicy chuẩn camelCase (isSuccess, statusCode, message, result)

                var serializerOptions = new JsonSerializerOptions
                {
                    PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                    WriteIndented = false
                };

                await context.Response.WriteAsync(JsonSerializer.Serialize(response, serializerOptions));
            }
        }
    }
}
