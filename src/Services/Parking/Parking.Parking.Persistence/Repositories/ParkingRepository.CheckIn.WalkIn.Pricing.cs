using Npgsql;
using Parking.ServiceDefaults;

namespace Parking.Parking.Persistence.Repositories;

public sealed partial class ParkingRepository
{
    // Commands are supplied by the caller and share its transaction and verified IDs.
    private static async Task<Guid> GetOrCreateWalkInPricingSnapshotAsync(Func<string, NpgsqlCommand> command, DateTimeOffset entryAt, int holdMinutes, int lateArrivalMinutes, CancellationToken ct)
    {
        // 8. Lấy Pricing Snapshot từ bảng giá PUBLISHED, hoặc tự tạo snapshot nếu plan PUBLISHED chưa có snapshot nào
        Guid snapshotId;
        await using (var snapshotQuery = command("""
            SELECT ps.id
            FROM pricing_snapshots ps
            JOIN pricing_plans p ON p.id = ps.plan_id AND p.lot_id = ps.lot_id AND p.vehicle_type = ps.vehicle_type
            WHERE ps.lot_id = @lot AND ps.vehicle_type = @type
              AND p.status = 'PUBLISHED'
              AND p.effective_from <= @entry
              AND (p.effective_until IS NULL OR p.effective_until >= @entry)
            ORDER BY p.version_no DESC, ps.created_at DESC
            LIMIT 1;
            """))
        {
            snapshotQuery.Parameters.AddWithValue("entry", entryAt.UtcDateTime);
            var found = await snapshotQuery.ExecuteScalarAsync(ct);
            if (found is Guid existingSnap)
            {
                snapshotId = existingSnap;
            }
            else
            {
                Guid? planId = null;
                string? rulesJson = null;
                await using (var planQuery = command("""
                    SELECT pp.id, pr.parameters::text
                    FROM pricing_plans pp
                    JOIN pricing_rules pr ON pr.plan_id = pp.id AND pr.rule_type = 'FLAT_BLOCK'
                    WHERE pp.lot_id = @lot AND pp.vehicle_type = @type
                      AND pp.status = 'PUBLISHED' AND pp.currency = 'VND'
                      AND pp.effective_from <= @entry
                      AND (pp.effective_until IS NULL OR pp.effective_until >= @entry)
                      AND NOT EXISTS (SELECT 1 FROM pricing_rules extra WHERE extra.plan_id = pp.id AND extra.id <> pr.id)
                    ORDER BY pp.version_no DESC
                    LIMIT 1;
                    """))
                {
                    planQuery.Parameters.AddWithValue("entry", entryAt.UtcDateTime);
                    await using var planReader = await planQuery.ExecuteReaderAsync(ct);
                    if (await planReader.ReadAsync(ct))
                    {
                        planId = planReader.GetGuid(0);
                        rulesJson = planReader.GetString(1);
                    }
                }

                if (planId is Guid activePlanId && rulesJson is not null)
                {
                    snapshotId = Guid.NewGuid();
                    await using var createSnapshot = command("""
                        INSERT INTO pricing_snapshots(id, lot_id, plan_id, vehicle_type, engine_version, resolved_rules, policy_snapshot, currency, created_at)
                        VALUES(@snapshot, @lot, @plan, @type, 'block-v1', @rules::jsonb,
                               jsonb_build_object('holdMinutes', @hold, 'lateArrivalMinutes', @late), 'VND', @entry);
                        """);
                    createSnapshot.Parameters.AddWithValue("snapshot", snapshotId);
                    createSnapshot.Parameters.AddWithValue("plan", activePlanId);
                    createSnapshot.Parameters.AddWithValue("rules", rulesJson);
                    createSnapshot.Parameters.AddWithValue("hold", holdMinutes);
                    createSnapshot.Parameters.AddWithValue("late", lateArrivalMinutes);
                    createSnapshot.Parameters.AddWithValue("entry", entryAt.UtcDateTime);
                    await createSnapshot.ExecuteNonQueryAsync(ct);
                }
                else
                {
                    await using var fallbackQuery = command("SELECT id FROM pricing_snapshots WHERE lot_id=@lot AND vehicle_type=@type ORDER BY created_at DESC LIMIT 1;");
                    if (await fallbackQuery.ExecuteScalarAsync(ct) is not Guid fallbackSnap)
                        throw new ServiceException(503, "Active pricing plan or snapshot not found for lot and vehicle type.");
                    snapshotId = fallbackSnap;
                }
            }
        }

        return snapshotId;
    }
}
