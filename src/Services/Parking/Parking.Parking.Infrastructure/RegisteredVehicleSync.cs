using Grpc.Core;
using Npgsql;
using Parking.Contracts.Identity.V1;
using Parking.ServiceDefaults;

namespace Parking.Parking.Infrastructure;

// Synchronizes a registered account/vehicle association, not proof of legal vehicle ownership.
public sealed class RegisteredVehicleSync(FacilityAuthorization.FacilityAuthorizationClient identity,
    Microsoft.Extensions.Configuration.IConfiguration config, NpgsqlDataSource db)
{
    public async Task EnsureAsync(Guid actor, Guid vehicle, CancellationToken ct)
    {
        RegisteredVehicleReply record;
        try
        {
            record=await identity.GetRegisteredVehicleAsync(new RegisteredVehicleRequest { UserId=actor.ToString(),VehicleId=vehicle.ToString() },
                headers:GrpcHeaders.For(config),deadline:DateTime.UtcNow.AddSeconds(5),cancellationToken:ct);
        }
        catch(RpcException e) when(e.StatusCode is StatusCode.NotFound or StatusCode.PermissionDenied)
        {throw new ServiceException(403,"Vehicle is not registered to the active account");}
        if(!Guid.TryParse(record.VehicleId,out var returned)||returned!=vehicle ||
            record.VehicleType is not ("CAR" or "MOTORBIKE") || !System.Text.RegularExpressions.Regex.IsMatch(record.Plate,"^[A-Z0-9]{1,20}$"))
            throw new ServiceException(409,"Invalid registered vehicle data");
        await using var conn=await db.OpenConnectionAsync(ct);await using var tx=await conn.BeginTransactionAsync(ct);
        await using(var claim=new NpgsqlCommand("SELECT lock_parking_resource('VEHICLE',@vehicle)",conn,tx))
        {claim.Parameters.AddWithValue("vehicle",vehicle);await claim.ExecuteNonQueryAsync(ct);}
        await using(var conflict=new NpgsqlCommand("""
            SELECT EXISTS(SELECT 1 FROM vehicles WHERE
              (id=@vehicle AND (plate_normalized<>@plate OR vehicle_type<>@type OR NOT is_active))
              OR (plate_country='VN' AND plate_normalized=@plate AND id<>@vehicle))
              OR EXISTS(SELECT 1 FROM user_vehicle_access WHERE vehicle_id=@vehicle AND user_id<>@actor AND revoked_at IS NULL)
            """,conn,tx))
        {
            conflict.Parameters.AddWithValue("vehicle",vehicle);conflict.Parameters.AddWithValue("plate",record.Plate);
            conflict.Parameters.AddWithValue("type",record.VehicleType);conflict.Parameters.AddWithValue("actor",actor);
            if((bool)(await conflict.ExecuteScalarAsync(ct))!)throw new ServiceException(409,"Vehicle data conflicts with parking history or another registration; staff review required");
        }
        await using(var write=new NpgsqlCommand("""
            INSERT INTO vehicles(id,plate_country,plate_normalized,vehicle_type,fuel_type,is_active)
              VALUES(@vehicle,'VN',@plate,@type,@fuel,true) ON CONFLICT(id) DO NOTHING;
            INSERT INTO user_vehicle_access(user_id,vehicle_id,access_kind,verified_at,is_primary)
              VALUES(@actor,@vehicle,'OWNER',now(),@primary)
              ON CONFLICT(user_id,vehicle_id) DO UPDATE SET verified_at=now(),revoked_at=NULL,is_primary=EXCLUDED.is_primary;
            """,conn,tx))
        {
            write.Parameters.AddWithValue("vehicle",vehicle);write.Parameters.AddWithValue("actor",actor);
            write.Parameters.AddWithValue("plate",record.Plate);write.Parameters.AddWithValue("type",record.VehicleType);
            write.Parameters.AddWithValue("fuel",record.FuelType);write.Parameters.AddWithValue("primary",record.IsPrimary);
            try {await write.ExecuteNonQueryAsync(ct);}
            catch(PostgresException e) when(e.SqlState=="23505") {throw new ServiceException(409,"Plate registration conflict; staff review required");}
        }
        await tx.CommitAsync(ct);
    }
}
