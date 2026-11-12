using Google.Protobuf;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Npgsql;
using Parking.Contracts.Payments.V1;
using Parking.ServiceDefaults;

namespace Parking.Payment.Infrastructure;

public sealed class OutboxWorker(NpgsqlDataSource db,ParkingPaymentEvents.ParkingPaymentEventsClient parking,IConfiguration config,ILogger<OutboxWorker> logger):BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer=new PeriodicTimer(TimeSpan.FromSeconds(2));
        while(await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                await using var conn=await db.OpenConnectionAsync(stoppingToken);await using var tx=await conn.BeginTransactionAsync(stoppingToken);
                Guid id;string payload;int attempts;
                await using(var read=new NpgsqlCommand("SELECT event_id,payload::text,attempts FROM integration_outbox WHERE delivered_at IS NULL AND next_attempt_at<=now() ORDER BY occurred_at LIMIT 1 FOR UPDATE SKIP LOCKED",conn,tx))
                {
                    await using var r=await read.ExecuteReaderAsync(stoppingToken);
                    if(!await r.ReadAsync(stoppingToken))continue;
                    id=r.GetGuid(0);payload=r.GetString(1);attempts=r.GetInt32(2);
                }
                string? outcome=null;
                try
                {
                    var message=JsonParser.Default.Parse<PaymentSucceeded>(payload);
                    var response=await parking.DeliverPaymentSucceededAsync(message,headers:GrpcHeaders.For(config),deadline:DateTime.UtcNow.AddSeconds(5),cancellationToken:stoppingToken);
                    outcome=response.Outcome;
                }
                catch(OperationCanceledException)when(stoppingToken.IsCancellationRequested){break;}
                catch(Exception e){logger.LogWarning("Payment event delivery failed: {Type}; will retry",e.GetType().Name);}
                await using var update=new NpgsqlCommand(outcome is null
                    ?"UPDATE integration_outbox SET attempts=attempts+1,next_attempt_at=now()+@delay,last_error='DELIVERY_FAILED' WHERE event_id=@id"
                    :"UPDATE integration_outbox SET attempts=attempts+1,delivered_at=now(),last_error=NULL WHERE event_id=@id",conn,tx);
                update.Parameters.AddWithValue("id",id);
                if(outcome is null)update.Parameters.AddWithValue("delay",TimeSpan.FromSeconds(Math.Min(300,Math.Pow(2,Math.Min(attempts+1,8)))));
                await update.ExecuteNonQueryAsync(stoppingToken);await tx.CommitAsync(stoppingToken);
            }
            catch(OperationCanceledException)when(stoppingToken.IsCancellationRequested){break;}
            catch(Exception e){logger.LogWarning("Outbox worker unavailable: {Type}",e.GetType().Name);}
        }
    }
}
