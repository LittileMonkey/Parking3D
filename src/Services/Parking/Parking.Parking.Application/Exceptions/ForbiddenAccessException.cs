namespace Parking.Parking.Application.Exceptions;

// Ngoại lệ khi vi phạm phân quyền hoặc quyền sở hữu tài nguyên
public class ForbiddenAccessException : Exception
{
    public string? ErrorCode { get; }

    /// <summary>Biểu diễn yêu cầu không đủ quyền để middleware trả HTTP 403.</summary>
    public ForbiddenAccessException(string message = "Forbidden: Resource ownership or facility scope violation", string? errorCode = "Forbidden")
        : base(message)
    {
        ErrorCode = errorCode;
    }
}
