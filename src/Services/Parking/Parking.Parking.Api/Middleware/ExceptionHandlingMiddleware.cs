using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
using FluentValidation;
using System.Net;
using System.Text.Json;


namespace Parking.Parking.Api.Middleware
{
    // 1. Lớp cấu trúc trả về lỗi (Của Mentor)
    public class ErrorMessage
    {
        public string Message { get; set; } = "Đã xảy ra lỗi hệ thống.";
        public List<ErrorDetail> ErrorDetails { get; set; } = new();
    }
    public class ErrorDetail
    {
        public string ErrorMessage { get; set; } = string.Empty;
        public string ErrorCode { get; set; } = string.Empty;
        public string ErrorField { get; set; } = string.Empty;
    }
    // 2. Lớp xử lý phân loại lỗi (Theo đúng chuẩn mẫu của Mentor)
    public class ErrorExceptionHandler
    {
        private readonly Dictionary<Type, Func<Exception, ErrorMessage>> ExceptionHandling;

        public ErrorExceptionHandler()
        {
            this.ExceptionHandling = new Dictionary<Type, Func<Exception, ErrorMessage>>
            {
                { typeof(ValidationException), HandleValidationException },
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
    }
    // 3. Lớp Middleware đứng chặn ở cổng Server (Của Mentor)
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

                await context.Response.WriteAsync(JsonSerializer.Serialize(errorMessage));
            }
        }
    }
}
