namespace Parking.Parking.Application.Exceptions;

// Ngoại lệ khi không tìm thấy tài nguyên
public class NotFoundException : Exception
{
    public string? ErrorCode { get; }
    public string? ErrorField { get; }

    /// <summary>Biểu diễn tài nguyên không tồn tại để middleware trả HTTP 404.</summary>
    public NotFoundException(string message, string? errorCode = "NotFound", string? errorField = null)
        : base(message)
    {
        ErrorCode = errorCode;
        ErrorField = errorField;
    }
}
