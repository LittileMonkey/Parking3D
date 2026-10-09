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
    // 2. Lớp xử lý phân loại lỗi (Của Mentor)
    public class ErrorExceptionHandler
    {
        public (int, ErrorMessage) HandleException(Exception exception)
        {
            if (exception is ValidationException validationException)
            {
                var listError = validationException.Errors.Select(error => new ErrorDetail
                {
                    ErrorMessage = error.ErrorMessage,
                    ErrorCode = error.ErrorCode,
                    ErrorField = error.PropertyName,
                }).ToList();
                return (StatusCodes.Status400BadRequest, new ErrorMessage { Message = "Dữ liệu không hợp lệ", ErrorDetails = listError });
            }

            // Bắt lỗi chung chung (500 Server Error)
            return (StatusCodes.Status500InternalServerError, new ErrorMessage
            {
                Message = "Lỗi hệ thống",
                ErrorDetails = new List<ErrorDetail> { new ErrorDetail { ErrorMessage = exception.Message } }
            });
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
