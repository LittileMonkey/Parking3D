namespace Parking.Identity.Application;

public sealed record RegisterRequest(string Email, string Password, string FullName);
public sealed record LoginRequest(string Email, string Password);
public sealed record TokenReply(string AccessToken, DateTimeOffset ExpiresAt);
public sealed record AssignmentRequest(Guid LotId, Guid UserId, string Role, DateTimeOffset ActiveFrom,
    DateTimeOffset? ActiveTo, bool CanManageStaffAssignments = false);

public interface IIdentityService
{
    Task<Guid> RegisterAsync(RegisterRequest request, CancellationToken ct);
    Task<TokenReply> LoginAsync(LoginRequest request, CancellationToken ct);
    Task<bool> CheckAccessAsync(Guid userId, Guid lotId, string capability, CancellationToken ct);
    Task<Guid> AssignAsync(Guid actorId, AssignmentRequest request, CancellationToken ct);
    Task BootstrapAsync(CancellationToken ct);
}
