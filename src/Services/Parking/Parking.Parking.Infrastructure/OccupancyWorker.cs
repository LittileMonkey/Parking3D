using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Npgsql;
using Parking.Contracts.AI.V1;
using Parking.ServiceDefaults;

namespace Parking.Parking.Infrastructure;

public sealed class OccupancyWorker(NpgsqlDataSource db,OccupancyIngestion.OccupancyIngestionClient client,IConfiguration config,ILogger<OccupancyWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer=new PeriodicTimer(TimeSpan.FromSeconds(60));
        while(await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                var snapshots=new List<OccupancySnapshotRequest>();
                await using(var cmd=db.CreateCommand("""
                    SELECT p.lot_id,p.vehicle_type,count(s.id)::int,
                    count(s.id) FILTER(WHERE EXISTS(SELECT 1 FROM session_slot_assignments a WHERE a.slot_id=s.id AND a.vacated_at IS NULL))::int,
                    count(s.id) FILTER(WHERE NOT EXISTS(SELECT 1 FROM session_slot_assignments a WHERE a.slot_id=s.id AND a.vacated_at IS NULL)
                      AND EXISTS(SELECT 1 FROM slot_reservations r WHERE r.slot_id=s.id AND r.status IN ('HELD','CONFIRMED')
                        AND r.starts_at<=now() AND now()<r.ends_at AND (r.status='CONFIRMED' OR EXISTS(SELECT 1 FROM bookings b WHERE b.id=r.booking_id AND b.hold_expires_at>now()))))::int
                    FROM lot_vehicle_policies p LEFT JOIN slot_vehicle_types v ON v.lot_id=p.lot_id AND v.vehicle_type=p.vehicle_type
                    LEFT JOIN parking_slots s ON s.id=v.slot_id AND s.operational_status='ACTIVE'
                    GROUP BY p.lot_id,p.vehicle_type
                    """))
                {
                    await using var r=await cmd.ExecuteReaderAsync(stoppingToken);
                    while(await r.ReadAsync(stoppingToken))snapshots.Add(new OccupancySnapshotRequest{LotId=r.GetGuid(0).ToString(),VehicleType=r.GetString(1),
                        UsableCapacity=r.GetInt32(2),OccupiedCount=r.GetInt32(3),ReservedCount=r.GetInt32(4),ObservedAtUnixSeconds=DateTimeOffset.UtcNow.ToUnixTimeSeconds()});
                }
                foreach(var snapshot in snapshots)await client.RecordSnapshotAsync(snapshot,headers:GrpcHeaders.For(config),deadline:DateTime.UtcNow.AddSeconds(5),cancellationToken:stoppingToken);
            }
            catch(OperationCanceledException) when(stoppingToken.IsCancellationRequested){break;}
            catch(Exception e){logger.LogWarning("Snapshot collection/delivery failed: {Type}",e.GetType().Name);}
        }
    }
}
