using Grpc.Core;
using Npgsql;
using Parking.Contracts.AI.V1;

namespace Parking.AI.Infrastructure;

public sealed class OccupancyIngestionGrpc(NpgsqlDataSource db) : OccupancyIngestion.OccupancyIngestionBase
{
    public override async Task<SnapshotReply> RecordSnapshot(OccupancySnapshotRequest request, ServerCallContext context)
    {
        if(!Guid.TryParse(request.LotId,out var lot) || lot==Guid.Empty || string.IsNullOrWhiteSpace(request.VehicleType)
            || request.VehicleType.Length>32 || request.UsableCapacity<0 || request.OccupiedCount<0 || request.ReservedCount<0
            || request.OccupiedCount+request.ReservedCount>request.UsableCapacity)
            throw new RpcException(new Status(StatusCode.InvalidArgument,"Invalid capacity snapshot"));
        DateTime observed;
        try { observed=DateTimeOffset.FromUnixTimeSeconds(request.ObservedAtUnixSeconds).UtcDateTime; }
        catch(ArgumentOutOfRangeException){throw new RpcException(new Status(StatusCode.InvalidArgument,"Invalid timestamp"));}
        if(observed>DateTime.UtcNow) throw new RpcException(new Status(StatusCode.InvalidArgument,"Future snapshot"));
        var id=Guid.NewGuid();
        await using var command=db.CreateCommand("""
            INSERT INTO occupancy_snapshots(id,lot_id,vehicle_type,observed_at,usable_capacity,occupied_count,reserved_count,data_source)
            VALUES(@id,@lot,@type,@observed,@cap,@occupied,@reserved,'ACTUAL')
            ON CONFLICT(lot_id,vehicle_type,observed_at,data_source) DO UPDATE SET observed_at=EXCLUDED.observed_at RETURNING id
            """);
        command.Parameters.AddWithValue("id",id); command.Parameters.AddWithValue("lot",lot); command.Parameters.AddWithValue("type",request.VehicleType);
        command.Parameters.AddWithValue("observed",observed); command.Parameters.AddWithValue("cap",request.UsableCapacity);
        command.Parameters.AddWithValue("occupied",request.OccupiedCount); command.Parameters.AddWithValue("reserved",request.ReservedCount);
        return new SnapshotReply { SnapshotId=((Guid)(await command.ExecuteScalarAsync(context.CancellationToken))!).ToString() };
    }
}
