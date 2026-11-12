BEGIN;
CREATE TABLE IF NOT EXISTS staff_shifts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lot_id uuid NOT NULL REFERENCES parking_lots(id),
    staff_user_id uuid NOT NULL,
    started_at timestamptz NOT NULL DEFAULT now(),
    ended_at timestamptz,
    CHECK (ended_at IS NULL OR ended_at >= started_at),
    UNIQUE(id,lot_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_staff_shift_open ON staff_shifts(lot_id,staff_user_id) WHERE ended_at IS NULL;
COMMIT;
