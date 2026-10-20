using Grpc.Core;
using Parking.Contracts.Identity.V1;
using Parking.Identity.Application.Common.Interface;

namespace Parking.Identity.Infrastructure;

public sealed class FacilityAuthorizationGrpc(IAssignedLotRepository lotRepository) : FacilityAuthorization.FacilityAuthorizationBase
{
    public override async Task<AccessReply> CheckAccess(AccessRequest request, ServerCallContext context)
    {
        if (!Guid.TryParse(request.UserId, out var userId) || !Guid.TryParse(request.LotId, out var lotId))
            throw new RpcException(new Status(StatusCode.InvalidArgument, "UUID required"));

        var allowed = await lotRepository.CheckAccessAsync(userId, lotId, request.Capability, context.CancellationToken);
        return new AccessReply { Allowed = allowed, ReasonCode = allowed ? "ALLOWED" : "DENIED" };
    }
}
