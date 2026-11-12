using Grpc.Core;
using Parking.Contracts.Identity.V1;
using Parking.Identity.Application.Common.Interface;

namespace Parking.Identity.Infrastructure;

public sealed class FacilityAuthorizationGrpc(IAssignedLotRepository lotRepository, IUserVehicleRepository vehicles) : FacilityAuthorization.FacilityAuthorizationBase
{
    public override async Task<RegisteredVehicleReply> GetRegisteredVehicle(RegisteredVehicleRequest request, ServerCallContext context)
    {
        if(!Guid.TryParse(request.UserId,out var user)||!Guid.TryParse(request.VehicleId,out var vehicle))
            throw new RpcException(new Status(StatusCode.InvalidArgument,"Valid user and vehicle IDs required"));
        if(!await lotRepository.CheckAccessAsync(user,Guid.Empty,"USER",context.CancellationToken))
            throw new RpcException(new Status(StatusCode.PermissionDenied,"Active account required"));
        var record=await vehicles.GetVehicleByIdAsync(user,vehicle,context.CancellationToken);
        if(record is null)throw new RpcException(new Status(StatusCode.NotFound,"Vehicle is not registered to this account"));
        var type=record.VehicleType.ToUpperInvariant() switch { "CAR" or "EV" => "CAR", "BIKE" or "MOTORBIKE" or "MOTORCYCLE" => "MOTORBIKE", _ => "" };
        if(type.Length==0)throw new RpcException(new Status(StatusCode.FailedPrecondition,"Unsupported vehicle type"));
        return new RegisteredVehicleReply { VehicleId=record.Id.ToString(), Plate=System.Text.RegularExpressions.Regex.Replace(record.LicensePlate.ToUpperInvariant(),@"[\s.-]",""), VehicleType=type, IsPrimary=record.IsDefault, FuelType=record.VehicleType.ToUpperInvariant()=="EV"?"ELECTRIC":"UNKNOWN" };
    }

    public override async Task<AccessReply> CheckAccess(AccessRequest request, ServerCallContext context)
    {
        if (!Guid.TryParse(request.UserId, out var userId) || !Guid.TryParse(request.LotId, out var lotId))
            throw new RpcException(new Status(StatusCode.InvalidArgument, "UUID required"));

        var allowed = await lotRepository.CheckAccessAsync(userId, lotId, request.Capability, context.CancellationToken);
        return new AccessReply { Allowed = allowed, ReasonCode = allowed ? "ALLOWED" : "DENIED" };
    }
}
