using System.Net.Http.Json;
using Microsoft.Extensions.Configuration;
using Parking.AI.Application;
using Parking.AI.Domain;
using Parking.ServiceDefaults;

namespace Parking.AI.Infrastructure;

public sealed class HttpPlateProvider(HttpClient http, IConfiguration config) : IPlateProvider
{
    public async Task<PlateCandidate> RecognizeAsync(byte[] image, string contentType, CancellationToken ct)
    {
        if (!Uri.TryCreate(config["AI:OcrEndpoint"], UriKind.Absolute, out var endpoint))
            throw new ServiceException(503, "OCR provider is not configured");
        if (endpoint.Scheme != "https" && !(config["ASPNETCORE_ENVIRONMENT"] == "Development" && endpoint.Scheme == "http"))
            throw new ServiceException(503, "OCR provider requires HTTPS");
        using var request = new HttpRequestMessage(HttpMethod.Post, endpoint)
        { Content = JsonContent.Create(new { imageBase64 = Convert.ToBase64String(image), contentType }) };
        var apiKey = config["AI:OcrApiKey"];
        if (!string.IsNullOrEmpty(apiKey)) request.Headers.TryAddWithoutValidation("X-Api-Key", apiKey);
        using var response = await http.SendAsync(request, ct);
        if (!response.IsSuccessStatusCode || response.Content.Headers.ContentLength > 16 * 1024)
            throw new ServiceException(503, "OCR provider unavailable");
        // Response body is also bounded when Content-Length is absent.
        await using var stream = await response.Content.ReadAsStreamAsync(ct);
        using var buffer = new MemoryStream();
        var bytes = new byte[4096]; int n;
        while ((n = await stream.ReadAsync(bytes, ct)) > 0)
        { if (buffer.Length + n > 16 * 1024) throw new ServiceException(503, "Invalid OCR response"); await buffer.WriteAsync(bytes.AsMemory(0,n),ct); }
        buffer.Position = 0;
        var candidate = await System.Text.Json.JsonSerializer.DeserializeAsync<PlateCandidate>(buffer,
            new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true }, ct);
        if (candidate is null || string.IsNullOrWhiteSpace(candidate.ModelVersion) || candidate.ModelVersion.Length > 128
            || (candidate.Plate is not null && (!ImageRules.IsNormalizedPlate(candidate.Plate) || candidate.Confidence is null or < 0 or > 1 || !double.IsFinite(candidate.Confidence.Value)))
            || (candidate.Plate is null && candidate.Confidence is not null))
            throw new ServiceException(503, "Invalid OCR response");
        return candidate;
    }
}
