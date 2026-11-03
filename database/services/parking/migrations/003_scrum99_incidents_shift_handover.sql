-- SCRUM-99: Incidents & Shift Handover Migration
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, pg_catalog;

-- 1. Bổ sung các cột phục vụ quản lý sự cố và ngoại lệ vào bảng parking_issues
ALTER TABLE public.parking_issues ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT '';
ALTER TABLE public.parking_issues ADD COLUMN IF NOT EXISTS severity text NOT NULL DEFAULT 'Medium';
ALTER TABLE public.parking_issues ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '';
ALTER TABLE public.parking_issues ADD COLUMN IF NOT EXISTS detected_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.parking_issues ADD COLUMN IF NOT EXISTS late_report_reason text;
ALTER TABLE public.parking_issues ADD COLUMN IF NOT EXISTS related_plate text;
ALTER TABLE public.parking_issues ADD COLUMN IF NOT EXISTS related_slot_code text;
ALTER TABLE public.parking_issues ADD COLUMN IF NOT EXISTS related_gate text;
ALTER TABLE public.parking_issues ADD COLUMN IF NOT EXISTS evidence jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.parking_issues ADD COLUMN IF NOT EXISTS exit_decision jsonb;
ALTER TABLE public.parking_issues ADD COLUMN IF NOT EXISTS version int NOT NULL DEFAULT 1;
ALTER TABLE public.parking_issues ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 2. Bảng lưu lịch sử thay đổi trạng thái và hành động sự cố (Incident History Audit)
CREATE TABLE IF NOT EXISTS public.incident_history (
    id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id uuid NOT NULL,
    lot_id uuid NOT NULL,
    action text NOT NULL,
    from_status text,
    to_status text,
    performed_by_user_id uuid NOT NULL,
    reason text,
    performed_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (incident_id, lot_id) REFERENCES public.parking_issues(id, lot_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_incident_history_lookup ON public.incident_history (lot_id, incident_id, performed_at DESC);

-- 3. Bảng bàn giao ca trực (Shift Handovers)
CREATE TABLE IF NOT EXISTS public.shift_handovers (
    id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    lot_id uuid NOT NULL,
    sender_shift_id uuid NOT NULL,
    receiver_shift_id uuid NOT NULL,
    sender_user_id uuid NOT NULL,
    receiver_user_id uuid NOT NULL,
    completed_tasks text NOT NULL,
    unresolved_issues text NOT NULL,
    pending_transactions text NOT NULL,
    equipment_status text,
    notes_for_next text NOT NULL,
    status text NOT NULL DEFAULT 'PendingConfirmation',
    created_at timestamptz NOT NULL DEFAULT now(),
    confirmed_at timestamptz,
    confirmed_by_user_id uuid,
    version int NOT NULL DEFAULT 1,
    FOREIGN KEY (lot_id) REFERENCES public.parking_lots(id) ON DELETE RESTRICT,
    UNIQUE (id, lot_id),
    CONSTRAINT chk_shift_handovers_diff_users CHECK (sender_user_id <> receiver_user_id)
);

CREATE INDEX IF NOT EXISTS idx_shift_handovers_lot_status ON public.shift_handovers (lot_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shift_handovers_actors ON public.shift_handovers (sender_user_id, receiver_user_id);

-- 4. Bảng lưu lịch sử bàn giao ca trực (Reassignment / Actions)
CREATE TABLE IF NOT EXISTS public.shift_handover_history (
    id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    handover_id uuid NOT NULL,
    lot_id uuid NOT NULL,
    action text NOT NULL,
    old_receiver_user_id uuid,
    new_receiver_user_id uuid,
    performed_by_user_id uuid NOT NULL,
    reason text,
    performed_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (handover_id, lot_id) REFERENCES public.shift_handovers(id, lot_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_shift_handover_history_lookup ON public.shift_handover_history (lot_id, handover_id, performed_at DESC);

DO $migration$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.service_schema_versions WHERE version = 3) THEN
        INSERT INTO public.service_schema_versions(version) VALUES (3);
    END IF;
END
$migration$;

COMMIT;
