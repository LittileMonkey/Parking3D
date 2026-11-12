-- SCRUM-114: upgrade existing handover tables and preserve their data.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, pg_catalog;

DO $migration$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.shift_handovers'::regclass
          AND conname = 'shift_handovers_id_lot_id_key'
    ) THEN
        ALTER TABLE public.shift_handovers
            ADD CONSTRAINT shift_handovers_id_lot_id_key UNIQUE (id, lot_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.shift_handovers'::regclass
          AND conname = 'chk_shift_handovers_diff_users'
    ) THEN
        ALTER TABLE public.shift_handovers
            ADD CONSTRAINT chk_shift_handovers_diff_users CHECK (sender_user_id <> receiver_user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.shift_handover_history'::regclass
          AND conname = 'shift_handover_history_handover_id_lot_id_fkey'
    ) THEN
        ALTER TABLE public.shift_handover_history
            ADD CONSTRAINT shift_handover_history_handover_id_lot_id_fkey
            FOREIGN KEY (handover_id, lot_id) REFERENCES public.shift_handovers (id, lot_id)
            ON DELETE CASCADE;
    END IF;
END
$migration$;

INSERT INTO public.service_schema_versions(version) VALUES (9) ON CONFLICT DO NOTHING;
COMMIT;
