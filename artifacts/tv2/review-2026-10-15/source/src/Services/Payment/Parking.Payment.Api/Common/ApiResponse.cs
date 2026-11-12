using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Payment.Api.Common
{
    public class ApiResponse<T>
    {
        public bool IsSuccess { get; set; }
        public int StatusCode { get; set; }
        public string Message { get; set; } = string.Empty;
        public T? Result { get; set; }


        public ApiResponse() { }

        public ApiResponse(T? result, string message = "Success", int statusCode = 200)
        {
            IsSuccess = true;
            StatusCode = statusCode;
            Message = message;
            Result = result;
        }


        public static ApiResponse<T> Success(T data, string message = "Success", int statusCode = 200) 
            => new () { IsSuccess = true, StatusCode = statusCode, Message = message, Result = data };

        public static ApiResponse<T> Fail(T data, string message = "Fail", int statusCode = 400)
            => new() { IsSuccess = false, StatusCode = statusCode, Message = message, Result = data };

    }
}
