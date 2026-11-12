-- Private evidence images owned by Parking, scoped to their facility.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, pg_catalog;

CREATE TABLE IF NOT EXISTS public.incident_evidence_images (
    id uuid PRIMARY KEY,
    lot_id uuid NOT NULL REFERENCES public.parking_lots(id) ON DELETE RESTRICT,
    uploaded_by_user_id uuid NOT NULL,
    content_type text NOT NULL CHECK (content_type IN ('image/png', 'image/jpeg')),
    content_sha256 char(64) NOT NULL,
    content_bytes bytea NOT NULL CHECK (octet_length(content_bytes) BETWEEN 8 AND 4194304),
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    UNIQUE (id, lot_id)
);

INSERT INTO public.service_schema_versions(version) VALUES (10) ON CONFLICT DO NOTHING;
COMMIT;
