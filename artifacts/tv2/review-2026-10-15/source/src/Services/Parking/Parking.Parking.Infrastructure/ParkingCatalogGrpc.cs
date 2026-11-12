using Grpc.Core;
using Parking.Contracts.Catalog.V1;
using Parking.Parking.Application;

namespace Parking.Parking.Infrastructure;

public sealed class ParkingCatalogGrpc(IParkingRepository repository) : ParkingCatalog.ParkingCatalogBase
{
    public override async Task<LotReply> LotExists(LotRequest request,ServerCallContext context)
    {
        if(!Guid.TryParse(request.LotId,out var id))throw new RpcException(new Status(StatusCode.InvalidArgument,"UUID required"));
        return new LotReply{Exists=await repository.LotExistsAsync(id,context.CancellationToken)};
    }
}
