namespace Parking.Identity.Application.Common.Interface;
public interface IMfaVerifier
{
 Task RequireAsync(Guid userId, string? code, CancellationToken ct);
}
