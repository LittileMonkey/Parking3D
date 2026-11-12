using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Parking.Parking.Api.Common
{
    public class ApiResponse<T>
    {
        public T Result { get; set; }
        public bool IsSuccess { get; set; } = true;
        public int StatusCode { get; set; } = 200;
        public string Message { get; set; } = string.Empty;
        public ApiResponse(T result, string message = "Success")
        {
            Result = result;
            Message = message;
        }
    }
}
