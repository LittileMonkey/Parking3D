using Npgsql;
using Parking.ServiceDefaults;
using Parking.Parking.Application;
using System.Text.Json;

namespace Parking.Parking.Api;

public static class NotificationEndpoints
{
 public static void MapNotifications(this WebApplication app)
 {
  app.MapGet("/api/v1/notifications", async(HttpContext ctx, IFacilityAccess access, NpgsqlDataSource db, CancellationToken ct)=> {
   var user=ctx.User.Subject();await access.RequireAsync(user,Guid.Empty,"USER",ct);
   await using var cmd=db.CreateCommand("""
    SELECT jsonb_build_object('unreadCount',(SELECT count(*) FROM user_notifications WHERE user_id=@user AND read_at IS NULL),
      'items',coalesce((SELECT jsonb_agg(row_to_json(x)) FROM (
        SELECT id,booking_id AS "bookingId",kind,message,created_at AS "createdAt",read_at AS "readAt"
        FROM user_notifications WHERE user_id=@user ORDER BY created_at DESC,id DESC LIMIT 100
      )x),'[]'::jsonb))::text
    """);
   cmd.Parameters.AddWithValue("user",user);
   return Responses.Ok(JsonSerializer.Deserialize<JsonElement>((string)(await cmd.ExecuteScalarAsync(ct))!));
  }).RequireAuthorization();
  app.MapPost("/api/v1/notifications/read-all",async(HttpContext ctx,IFacilityAccess access,NpgsqlDataSource db,CancellationToken ct)=> {
   var user=ctx.User.Subject();await access.RequireAsync(user,Guid.Empty,"USER",ct);
   await using var cmd=db.CreateCommand("UPDATE user_notifications SET read_at=now() WHERE user_id=@user AND read_at IS NULL");cmd.Parameters.AddWithValue("user",user);await cmd.ExecuteNonQueryAsync(ct);return Responses.Ok(new{read=true});
  }).RequireAuthorization();
  app.MapPost("/api/v1/notifications/{id:guid}/read",async(Guid id,HttpContext ctx,IFacilityAccess access,NpgsqlDataSource db,CancellationToken ct)=> {
   var user=ctx.User.Subject();await access.RequireAsync(user,Guid.Empty,"USER",ct);
   await using var cmd=db.CreateCommand("UPDATE user_notifications SET read_at=coalesce(read_at,now()) WHERE id=@id AND user_id=@user");
   cmd.Parameters.AddWithValue("id",id);cmd.Parameters.AddWithValue("user",user);
   return await cmd.ExecuteNonQueryAsync(ct)>0?Responses.Ok(new{id}):Responses.Error(404,"Notification not found");
  }).RequireAuthorization();
 }
}
