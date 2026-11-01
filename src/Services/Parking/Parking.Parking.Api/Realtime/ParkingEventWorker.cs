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
