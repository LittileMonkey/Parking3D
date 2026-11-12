using Parking.ServiceDefaults;

namespace Parking.Parking.Api.Controllers;

internal static class ControllerRequestExtensions
{
    public static string ReadRequiredIdempotencyKey(this HttpRequest request) =>
        request.ReadOptionalIdempotencyKey() ??
        throw new ServiceException(400, "Idempotency-Key is required.", "IDEMPOTENCY_KEY_REQUIRED");

    /// <summary>
    /// Reads a single Idempotency-Key header value, rejecting duplicate headers with HTTP 400.
    /// Returns an empty string when absent so request validators can enforce presence uniformly.
    /// </summary>
    public static string ReadIdempotencyKeyOrEmpty(this HttpRequest request)
    {
        if (!request.Headers.TryGetValue("Idempotency-Key", out var values) || values.Count == 0)
            return string.Empty;
        if (values.Count > 1)
            throw new ServiceException(400, "Duplicate Idempotency-Key header is not allowed.");
        return values[0]?.Trim() ?? string.Empty;
    }

    /// <summary>
    /// Reads an optional single Idempotency-Key header value, rejecting duplicate headers
    /// and overly long/blank header values when the header is explicitly supplied.
    /// </summary>
    public static string? ReadOptionalIdempotencyKey(this HttpRequest request)
    {
        if (!request.Headers.TryGetValue("Idempotency-Key", out var values) || values.Count == 0)
            return null;
        if (values.Count > 1)
            throw new ServiceException(400, "Duplicate Idempotency-Key header is not allowed.");
        var trimmed = values[0]?.Trim();
        if (string.IsNullOrEmpty(trimmed) || trimmed.Length > 128)
            throw new ServiceException(400, "Idempotency-Key must be between 1 and 128 characters.");
        return trimmed;
    }
}
