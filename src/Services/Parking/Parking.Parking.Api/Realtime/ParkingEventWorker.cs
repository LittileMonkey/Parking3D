using System.Text.Json;
using Microsoft.AspNetCore.SignalR;
using Npgsql;

namespace Parking.Parking.Api.Realtime;

public sealed class ParkingEventWorker(NpgsqlDataSource data,IHubContext<ParkingHub> hub,
    ILogger<ParkingEventWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer=new PeriodicTimer(TimeSpan.FromMilliseconds(250));
        try
        {
            while(await timer.WaitForNextTickAsync(stoppingToken))
            {
                try
                {
                    await using var connection=await data.OpenConnectionAsync(stoppingToken);
                    await using var tx=await connection.BeginTransactionAsync(stoppingToken);
                    Guid id;string payload;
                    await using(var read=new NpgsqlCommand("""
                        SELECT event_id,payload::text FROM integration_outbox
                        WHERE event_type='SlotStatusChanged.v1' AND delivered_at IS NULL AND next_attempt_at<=now()
                        ORDER BY occurred_at,event_id LIMIT 1 FOR UPDATE SKIP LOCKED
                        """,connection,tx))
                    {
                        await using var reader=await read.ExecuteReaderAsync(stoppingToken);
                        if(!await reader.ReadAsync(stoppingToken))continue;
                        id=reader.GetGuid(0);payload=reader.GetString(1);
                    }
                    // Re-read canonical state: queued reservation events can be older than later commits.
                    // Never replay an old HELD/AVAILABLE value over current physical occupancy.
                    await using(var state=new NpgsqlCommand("""
                        SELECT (e.payload || jsonb_build_object('eventId',e.event_id,'observedAt',clock_timestamp(),
                          'status',CASE
                            WHEN EXISTS(SELECT 1 FROM session_slot_assignments a WHERE a.slot_id=s.id AND a.vacated_at IS NULL) THEN 'OCCUPIED'
                            WHEN s.operational_status<>'ACTIVE' THEN s.operational_status::text
                            WHEN EXISTS(SELECT 1 FROM slot_reservations r JOIN bookings b ON b.id=r.booking_id
                              WHERE r.slot_id=s.id AND r.ends_at>clock_timestamp() AND r.status IN ('HELD','CONFIRMED')
                                AND (b.status='CONFIRMED' OR (b.status='PENDING_PAYMENT' AND b.hold_expires_at>clock_timestamp()))) THEN 'HELD'
                            ELSE 'AVAILABLE' END))::text
                        FROM integration_outbox e JOIN parking_slots s ON s.id=e.aggregate_id WHERE e.event_id=@id
                        """,connection,tx))
                    {
                        state.Parameters.AddWithValue("id",id);
                        if(await state.ExecuteScalarAsync(stoppingToken) is string current)payload=current;
                    }
                    await hub.Clients.All.SendAsync("SlotStatusChanged",JsonSerializer.Deserialize<JsonElement>(payload),stoppingToken);
                    await using var done=new NpgsqlCommand("UPDATE integration_outbox SET delivered_at=now(),attempts=attempts+1,last_error=NULL WHERE event_id=@id",connection,tx);
                    done.Parameters.AddWithValue("id",id);await done.ExecuteNonQueryAsync(stoppingToken);await tx.CommitAsync(stoppingToken);
                }
                catch(OperationCanceledException)when(stoppingToken.IsCancellationRequested){break;}
                catch(Exception error){logger.LogWarning("Parking event delivery unavailable: {Type}",error.GetType().Name);}
            }
        }
        catch(OperationCanceledException)when(stoppingToken.IsCancellationRequested){ }
    }
}
