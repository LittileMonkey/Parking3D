-- Publish new versions; never rewrite booked amounts or resolved snapshots.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SET LOCAL search_path = public, pg_catalog;
DO $migration$
DECLARE
    target record;
    previous pricing_plans%ROWTYPE;
    next_id uuid;
    next_version integer;
    changed_at timestamptz := now();
BEGIN
    FOR target IN
        SELECT DISTINCT lot_id, vehicle_type FROM pricing_plans
        WHERE status='PUBLISHED' AND effective_from<=changed_at
          AND (effective_until IS NULL OR effective_until>changed_at)
        ORDER BY lot_id,vehicle_type
    LOOP
        PERFORM pg_advisory_xact_lock(hashtextextended('pricing:'||target.lot_id::text||':'||target.vehicle_type,0));
        SELECT * INTO previous FROM pricing_plans
        WHERE lot_id=target.lot_id AND vehicle_type=target.vehicle_type
          AND status='PUBLISHED' AND effective_from<=changed_at
          AND (effective_until IS NULL OR effective_until>changed_at)
        ORDER BY version_no DESC LIMIT 1 FOR UPDATE;
        IF NOT FOUND THEN CONTINUE; END IF;
        IF NOT EXISTS (
            SELECT 1 FROM pricing_rules WHERE plan_id=previous.id
              AND rule_type IN ('FLAT_BLOCK','FLAT_BLOCK_EV')
              AND coalesce((parameters->>'minimumChargeVnd')::bigint,0)<10000
        ) THEN CONTINUE; END IF;
        IF EXISTS (SELECT 1 FROM pricing_plans WHERE lot_id=target.lot_id
            AND vehicle_type=target.vehicle_type AND status='PUBLISHED' AND effective_from>changed_at) THEN
            RAISE EXCEPTION 'Scheduled pricing requires explicit review before minimum-charge migration';
        END IF;
        IF EXISTS (SELECT 1 FROM pricing_rules WHERE plan_id=previous.id
            AND rule_type IN ('FLAT_BLOCK','FLAT_BLOCK_EV')
            AND coalesce((parameters->>'dailyCapVnd')::bigint,0)<10000) THEN
            RAISE EXCEPTION 'Daily cap below 10000 VND; review pricing before minimum-charge migration';
        END IF;
        SELECT coalesce(max(version_no),0)+1 INTO next_version FROM pricing_plans
        WHERE lot_id=target.lot_id AND vehicle_type=target.vehicle_type;
        next_id := gen_random_uuid();
        UPDATE pricing_plans SET status='ARCHIVED',
            effective_until=greatest(changed_at,effective_from+interval '1 microsecond')
        WHERE lot_id=target.lot_id AND vehicle_type=target.vehicle_type AND status='PUBLISHED';
        INSERT INTO pricing_plans(id,lot_id,vehicle_type,version_no,name,status,effective_from,effective_until,currency,created_by)
        VALUES(next_id,previous.lot_id,previous.vehicle_type,next_version,
            left(previous.name,160)||' - minimum 10,000 VND','PUBLISHED',changed_at,previous.effective_until,previous.currency,previous.created_by);
        INSERT INTO pricing_rules(plan_id,lot_id,zone_id,rule_type,priority,amount,billing_unit_minutes,multiplier,parameters)
        SELECT next_id,lot_id,zone_id,rule_type,priority,amount,billing_unit_minutes,multiplier,
            CASE WHEN rule_type IN ('FLAT_BLOCK','FLAT_BLOCK_EV')
              THEN jsonb_set(parameters,'{minimumChargeVnd}',to_jsonb(greatest(10000::bigint,coalesce((parameters->>'minimumChargeVnd')::bigint,0))),true)
              ELSE parameters END
        FROM pricing_rules WHERE plan_id=previous.id;
        INSERT INTO audit_logs(lot_id,actor_type,action,entity_type,entity_id,reason,new_values)
        VALUES(previous.lot_id,'SYSTEM','PRICE_MINIMUM_MIGRATION','PRICING_PLAN',next_id::text,
            'Publish minimum charge of 10000 VND per visit; preserve existing snapshots',
            jsonb_build_object('previousPlanId',previous.id,'minimumChargeVnd',10000,'version',next_version));
    END LOOP;
END
$migration$;
INSERT INTO service_schema_versions(version) VALUES(12) ON CONFLICT DO NOTHING;
COMMIT;
