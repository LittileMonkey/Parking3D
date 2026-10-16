namespace Parking.Parking.Application.Exceptions;

// Ngoại lệ khi vi phạm phân quyền hoặc quyền sở hữu tài nguyên
public class ForbiddenAccessException : Exception
{
    public string? ErrorCode { get; }

    public ForbiddenAccessException(string message = "Forbidden: Resource ownership or facility scope violation", string? errorCode = "Forbidden")
        : base(message)
    {
        ErrorCode = errorCode;
    }
}
