namespace Parking.Parking.Application.Exceptions;

public sealed class ConflictException : Exception
{
    /// <summary>Biểu diễn xung đột trạng thái nghiệp vụ để middleware trả HTTP 409.</summary>
    public ConflictException(string message)
        : base(message)
    {
    }
}