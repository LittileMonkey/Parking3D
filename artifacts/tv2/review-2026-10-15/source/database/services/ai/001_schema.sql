-- Owned database: ai; run ONCE on an empty Development database.

BEGIN;

CREATE EXTENSION IF NOT EXISTS btree_gist;

SET LOCAL search_path = public, pg_catalog;

CREATE TYPE public.booking_status AS ENUM ('PENDING_PAYMENT', 'CONFIRMED', 'CHECKED_IN', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'NO_SHOW');

CREATE TYPE public.booking_mode AS ENUM ('EXACT_SLOT', 'AUTO_SLOT');

CREATE TYPE public.session_status AS ENUM ('ACTIVE', 'EXIT_PENDING', 'COMPLETED');

CREATE TYPE public.reservation_status AS ENUM ('HELD', 'CONFIRMED', 'RELEASED');

CREATE TYPE public.slot_operational_status AS ENUM ('ACTIVE', 'MAINTENANCE', 'DISABLED');

CREATE TYPE public.payment_status AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'PARTIALLY_REFUNDED', 'REFUNDED');

CREATE TYPE public.payment_method AS ENUM ('VNPAY', 'CASH');

CREATE TYPE public.map_version_status AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

CREATE FUNCTION public.reject_immutable_write() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only; insert corrections instead', TG_TABLE_NAME USING ERRCODE = '23514';
END $$;

CREATE TABLE public.ai_plate_recognitions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lot_id uuid NOT NULL,
    uploaded_by uuid NOT NULL,
    idempotency_key varchar(128) NOT NULL CHECK (btrim(idempotency_key) <> ''),
    image_sha256 varchar(64) NOT NULL CHECK (image_sha256 ~ '^[0-9a-f]{64}$'),
    image_object_key text CHECK (image_object_key IS NULL OR btrim(image_object_key) <> ''),
    candidate_plate varchar(20) CHECK (candidate_plate IS NULL OR candidate_plate ~ '^[A-Z0-9]{1,20}$'),
    confidence numeric(6,5) CHECK (confidence BETWEEN 0 AND 1),
    status text NOT NULL CHECK (status IN ('PROCESSING','PENDING_REVIEW','NO_PLATE','FAILED','REVIEWED','CONSUMED')),
    model_version text NOT NULL CHECK (btrim(model_version) <> ''),
    reviewed_plate varchar(20) CHECK (reviewed_plate IS NULL OR reviewed_plate ~ '^[A-Z0-9]{1,20}$'),
    reviewed_by uuid,
    reviewed_at timestamptz,
    consumed_at timestamptz,
    failure_code varchar(64),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL,
    version int NOT NULL DEFAULT 1 CHECK (version > 0),
    UNIQUE (lot_id, uploaded_by, idempotency_key),
    CHECK (expires_at > created_at),
    CHECK ((candidate_plate IS NULL) = (confidence IS NULL)),
    CHECK (status <> 'PENDING_REVIEW' OR candidate_plate IS NOT NULL),
    CHECK (status <> 'NO_PLATE' OR candidate_plate IS NULL),
    CHECK ((reviewed_by IS NULL AND reviewed_plate IS NULL AND reviewed_at IS NULL)
        OR (reviewed_by IS NOT NULL AND reviewed_plate IS NOT NULL AND reviewed_at IS NOT NULL)),
    CHECK ((status IN ('REVIEWED','CONSUMED')) = (reviewed_at IS NOT NULL)),
    CHECK ((status = 'CONSUMED') = (consumed_at IS NOT NULL)),
    CHECK (reviewed_at IS NULL OR reviewed_at >= created_at),
    CHECK (consumed_at IS NULL OR consumed_at >= reviewed_at),
    CHECK (status <> 'FAILED' OR failure_code IS NOT NULL)
);

CREATE INDEX ix_ai_plate_lot_created ON public.ai_plate_recognitions(lot_id, created_at DESC);

CREATE INDEX ix_ai_plate_expiry ON public.ai_plate_recognitions(expires_at);

CREATE TABLE public.occupancy_snapshots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lot_id uuid NOT NULL,
    vehicle_type text NOT NULL,
    observed_at timestamptz NOT NULL,
    usable_capacity int NOT NULL CHECK (usable_capacity >= 0),
    occupied_count int NOT NULL CHECK (occupied_count >= 0),
    reserved_count int NOT NULL CHECK (reserved_count >= 0),
    data_source text NOT NULL CHECK (data_source IN ('ACTUAL','SIMULATED')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version int NOT NULL DEFAULT 1 CHECK (version > 0),
    UNIQUE (lot_id, vehicle_type, observed_at, data_source),
    CHECK (occupied_count <= usable_capacity),
    CHECK (reserved_count <= usable_capacity - occupied_count),
    CHECK (observed_at <= created_at)
);

CREATE INDEX ix_occupancy_snapshot_history ON public.occupancy_snapshots(lot_id, vehicle_type, observed_at DESC);

CREATE TABLE public.occupancy_forecasts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lot_id uuid NOT NULL,
    vehicle_type text NOT NULL,
    generated_at timestamptz NOT NULL,
    target_at timestamptz NOT NULL,
    data_cutoff_at timestamptz NOT NULL,
    usable_capacity int NOT NULL CHECK (usable_capacity > 0),
    predicted_occupied numeric(12,3) NOT NULL,
    lower_occupied numeric(12,3),
    upper_occupied numeric(12,3),
    model_version text NOT NULL CHECK (btrim(model_version) <> ''),
    data_source text NOT NULL CHECK (data_source IN ('ACTUAL','SIMULATED')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version int NOT NULL DEFAULT 1 CHECK (version > 0),
    UNIQUE (lot_id, vehicle_type, generated_at, target_at, model_version, data_source),
    CHECK (target_at - generated_at IN (interval '30 minutes', interval '60 minutes', interval '120 minutes')),
    CHECK (data_cutoff_at <= generated_at AND generated_at <= created_at),
    CHECK (predicted_occupied BETWEEN 0 AND usable_capacity),
    CHECK ((lower_occupied IS NULL AND upper_occupied IS NULL)
        OR (lower_occupied IS NOT NULL AND upper_occupied IS NOT NULL
            AND lower_occupied >= 0 AND lower_occupied <= predicted_occupied
            AND predicted_occupied <= upper_occupied AND upper_occupied <= usable_capacity))
);

CREATE INDEX ix_occupancy_forecast_query ON public.occupancy_forecasts(lot_id, vehicle_type, target_at, generated_at DESC);

CREATE TABLE public.assistant_documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lot_id uuid,
    document_key varchar(128) NOT NULL CHECK (btrim(document_key) <> ''),
    revision int NOT NULL CHECK (revision > 0),
    title text NOT NULL CHECK (btrim(title) <> ''),
    language varchar(10) NOT NULL DEFAULT 'vi' CHECK (language = 'vi'),
    visibility text NOT NULL DEFAULT 'PUBLIC' CHECK (visibility = 'PUBLIC'),
    status text NOT NULL CHECK (status IN ('DRAFT','PUBLISHED','ARCHIVED')),
    source_reference text NOT NULL CHECK (btrim(source_reference) <> ''),
    approved_by uuid,
    published_at timestamptz,
    effective_from timestamptz NOT NULL,
    effective_until timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version int NOT NULL DEFAULT 1 CHECK (version > 0),
    UNIQUE NULLS NOT DISTINCT (lot_id, document_key, revision),
    CHECK (effective_until IS NULL OR effective_until > effective_from),
    CHECK ((approved_by IS NULL) = (published_at IS NULL)),
    CHECK (status <> 'PUBLISHED' OR (approved_by IS NOT NULL AND published_at IS NOT NULL)),
    CHECK (published_at IS NULL OR published_at >= created_at)
);

CREATE INDEX ix_assistant_document_retrieval ON public.assistant_documents(lot_id, status, language);

CREATE TABLE public.assistant_document_chunks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id uuid NOT NULL REFERENCES public.assistant_documents(id) ON DELETE CASCADE,
    chunk_index int NOT NULL CHECK (chunk_index >= 0),
    section_title text NOT NULL CHECK (btrim(section_title) <> ''),
    content text NOT NULL CHECK (btrim(content) <> ''),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version int NOT NULL DEFAULT 1 CHECK (version > 0),
    UNIQUE (document_id, chunk_index)
);

CREATE TABLE public.audit_logs (
    id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    lot_id uuid,
    actor_user_id uuid,
    actor_type text NOT NULL,
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id text NOT NULL,
    reason text,
    request_id text,
    old_values jsonb,
    new_values jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER tr_audit_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON public.audit_logs
  FOR EACH STATEMENT EXECUTE FUNCTION public.reject_immutable_write();

CREATE TABLE public.integration_outbox (
 event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_type text NOT NULL,
 aggregate_id uuid NOT NULL, payload jsonb NOT NULL, occurred_at timestamptz NOT NULL DEFAULT now(),
 delivered_at timestamptz, attempts int NOT NULL DEFAULT 0 CHECK(attempts>=0), next_attempt_at timestamptz NOT NULL DEFAULT now(), last_error text);
 CREATE INDEX ix_outbox_pending ON public.integration_outbox(next_attempt_at,occurred_at) WHERE delivered_at IS NULL;
 CREATE TABLE public.integration_inbox (
 event_id uuid PRIMARY KEY, event_type text NOT NULL, payload_hash text NOT NULL,
 received_at timestamptz NOT NULL DEFAULT now(), outcome text NOT NULL);
 CREATE TABLE public.service_schema_versions (version int PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
 INSERT INTO public.service_schema_versions(version) VALUES(1);

CREATE TABLE public.ai_lot_catalog (lot_id uuid PRIMARY KEY, name text NOT NULL, updated_at timestamptz NOT NULL);

COMMIT;
