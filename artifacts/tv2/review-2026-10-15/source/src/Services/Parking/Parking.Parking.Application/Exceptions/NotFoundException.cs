namespace Parking.Parking.Application.Exceptions;

// Ngoại lệ khi không tìm thấy tài nguyên
public class NotFoundException : Exception
{
    public string? ErrorCode { get; }
    public string? ErrorField { get; }

    public NotFoundException(string message, string? errorCode = "NotFound", string? errorField = null)
        : base(message)
    {
        ErrorCode = errorCode;
        ErrorField = errorField;
    }
}
