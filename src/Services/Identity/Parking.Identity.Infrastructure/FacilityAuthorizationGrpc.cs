using Grpc.Core;
using Parking.Contracts.Identity.V1;
using Parking.Identity.Application;

namespace Parking.Identity.Infrastructure;

public sealed class FacilityAuthorizationGrpc(IIdentityService identity) : FacilityAuthorization.FacilityAuthorizationBase
{
    public override async Task<AccessReply> CheckAccess(AccessRequest request, ServerCallContext context)
    {
        if (!Guid.TryParse(request.UserId, out var user) || !Guid.TryParse(request.LotId, out var lot))
            throw new RpcException(new Status(StatusCode.InvalidArgument, "UUID required"));
        var allowed = await identity.CheckAccessAsync(user, lot, request.Capability, context.CancellationToken);
        return new AccessReply { Allowed = allowed, ReasonCode = allowed ? "ALLOWED" : "DENIED" };
    }
}
