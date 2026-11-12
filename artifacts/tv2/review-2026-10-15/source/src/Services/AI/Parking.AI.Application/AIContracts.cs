namespace Parking.AI.Application;

public sealed record PlateCandidate(string? Plate, double? Confidence, string ModelVersion);
public interface IPlateProvider
{
    Task<PlateCandidate> RecognizeAsync(byte[] image, string contentType, CancellationToken ct);
}
public sealed record PlateReviewRequest(string Plate, int Version, string Reason);
public sealed record AssistantRequest(string Question);
public sealed record DocumentRequest(Guid? LotId, string DocumentKey, int Revision, string Title,
    string SourceReference, DateTimeOffset EffectiveFrom, DateTimeOffset? EffectiveUntil, string Content);
