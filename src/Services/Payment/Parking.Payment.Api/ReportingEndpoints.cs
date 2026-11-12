using System.Text.Json;
using Npgsql;
using Parking.Contracts.Identity.V1;
using Parking.ServiceDefaults;

namespace Parking.Payment.Api;

public static class ReportingEndpoints
{
    public static void MapPaymentReports(this WebApplication app)
    {
        app.MapGet("/api/v1/payments/reports/{lotId:guid}", async (Guid lotId, DateTimeOffset from, DateTimeOffset until,
            HttpContext ctx, FacilityAuthorization.FacilityAuthorizationClient identity, IConfiguration config, NpgsqlDataSource db, CancellationToken ct) =>
        {
            if (until<=from || until-from>TimeSpan.FromDays(366)) return Responses.Error(400,"Select a range of at most 366 days.");
            var permission = await identity.CheckAccessAsync(new AccessRequest { UserId=ctx.User.Subject().ToString(), LotId=lotId.ToString(), Capability="REPORT" },
                headers:GrpcHeaders.For(config),deadline:DateTime.UtcNow.AddSeconds(3),cancellationToken:ct);
            if (!permission.Allowed) return Responses.Error(403,"Assigned Manager required.");
            await using var cmd = db.CreateCommand("""
                WITH successful AS (
                  SELECT p.* FROM payments p JOIN billing_accounts a ON a.id=p.account_id WHERE a.lot_id=@lot
                    AND p.status IN ('SUCCESS','PARTIALLY_REFUNDED','REFUNDED') AND p.succeeded_at>=@from AND p.succeeded_at<@until
                ), returned AS (
                  SELECT coalesce(sum(r.amount),0) amount FROM refunds r JOIN payments p ON p.id=r.payment_id
                  JOIN billing_accounts a ON a.id=p.account_id WHERE a.lot_id=@lot AND r.status='SUCCESS'
                    AND r.succeeded_at>=@from AND r.succeeded_at<@until
                )
                SELECT jsonb_build_object('lotId',@lot,'from',@from,'until',@until,'currency','VND',
                  'gross',coalesce(sum(amount),0),'cash',coalesce(sum(amount) FILTER(WHERE method='CASH'),0),
                  'digital',coalesce(sum(amount) FILTER(WHERE method<>'CASH'),0),'transactions',count(*),
                  'refunds',(SELECT amount FROM returned),'net',coalesce(sum(amount),0)-(SELECT amount FROM returned))::text
                FROM successful
                """);
            cmd.Parameters.AddWithValue("lot",lotId); cmd.Parameters.AddWithValue("from",from.ToUniversalTime()); cmd.Parameters.AddWithValue("until",until.ToUniversalTime());
            return Responses.Ok(JsonSerializer.Deserialize<JsonElement>((string)(await cmd.ExecuteScalarAsync(ct))!));
        }).RequireAuthorization();
    }
}
