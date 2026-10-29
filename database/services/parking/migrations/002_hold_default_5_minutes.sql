-- Parking database only. Repeatable migration from service schema version 1.
-- Explicit custom policies and deadlines of existing bookings are preserved.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, pg_catalog;

ALTER TABLE public.lot_vehicle_policies ALTER COLUMN hold_minutes SET DEFAULT 5;

DO $migration$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.service_schema_versions WHERE version = 2) THEN
        -- Only the two known demo policies with the old default are backfilled.
        -- Review other existing facilities individually; their values may be intentional.
        UPDATE public.lot_vehicle_policies
        SET hold_minutes = 5
        WHERE hold_minutes = 15
          AND (lot_id, vehicle_type) IN (
            ('11111111-1111-4111-8111-111111111111'::uuid, 'CAR'),
            ('22222222-2222-4222-8222-222222222222'::uuid, 'MOTORBIKE')
          );
        INSERT INTO public.service_schema_versions(version) VALUES (2);
    END IF;
END
$migration$;
COMMIT;
