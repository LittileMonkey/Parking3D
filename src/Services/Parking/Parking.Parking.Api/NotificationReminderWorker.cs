using Npgsql;
namespace Parking.Parking.Api;
public sealed class NotificationReminderWorker(NpgsqlDataSource db,ILogger<NotificationReminderWorker> log):BackgroundService
{
 protected override async Task ExecuteAsync(CancellationToken ct)
 {
  using var timer=new PeriodicTimer(TimeSpan.FromSeconds(30));
  try{while(await timer.WaitForNextTickAsync(ct)){try{
   await using var cmd=db.CreateCommand("""
    INSERT INTO user_notifications(user_id,booking_id,kind,message,dedupe_key)
    SELECT customer_id,id,'ARRIVAL_REMINDER','Sắp đến giờ đặt chỗ '||code,id::text||':arrival-reminder' FROM bookings
    WHERE customer_id IS NOT NULL AND status='CONFIRMED' AND starts_at>now() AND starts_at<=now()+interval '15 minutes'
    ON CONFLICT(dedupe_key) DO NOTHING;
    INSERT INTO user_notifications(user_id,booking_id,kind,message,dedupe_key)
    SELECT customer_id,id,'EXIT_REMINDER','Đặt chỗ '||code||' sắp hết thời gian; có thể phát sinh phí quá giờ.',id::text||':exit-reminder' FROM bookings
    WHERE customer_id IS NOT NULL AND status='CHECKED_IN' AND ends_at>now() AND ends_at<=now()+interval '15 minutes'
    ON CONFLICT(dedupe_key) DO NOTHING
    """);await cmd.ExecuteNonQueryAsync(ct);
  }catch(OperationCanceledException)when(ct.IsCancellationRequested){break;}catch(Exception e){log.LogWarning("Notification reminders deferred: {Type}",e.GetType().Name);}}}catch(OperationCanceledException)when(ct.IsCancellationRequested){}
 }
}
