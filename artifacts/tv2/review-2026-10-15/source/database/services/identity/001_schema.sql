-- Owned database: identity; run ONCE on an empty Development database.

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

CREATE TABLE public.app_users (
    id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    email_normalized text UNIQUE,
    phone_e164 varchar(20) UNIQUE,
    full_name varchar(200) NOT NULL,
    password_hash text,
    email_verified_at timestamptz,
    phone_verified_at timestamptz,
    status text NOT NULL,
    locked_until timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.platform_user_roles (
    user_id uuid NOT NULL,
    role_code text NOT NULL,
    PRIMARY KEY (user_id, role_code)
);

CREATE TABLE public.auth_tokens (
    id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    token_hash text NOT NULL UNIQUE,
    family_id uuid NOT NULL,
    purpose text NOT NULL,
    expires_at timestamptz NOT NULL,
    consumed_at timestamptz,
    revoked_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.lot_staff_assignments (
    id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    lot_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role_code text NOT NULL,
    valid_from timestamptz NOT NULL,
    valid_until timestamptz,
    revoked_at timestamptz
);

ALTER TABLE public.auth_tokens ADD CONSTRAINT fk_core_004 FOREIGN KEY (user_id) REFERENCES public.app_users (id) ON DELETE RESTRICT;

ALTER TABLE public.lot_staff_assignments ADD CONSTRAINT fk_core_022 FOREIGN KEY (user_id) REFERENCES public.app_users (id) ON DELETE RESTRICT;

ALTER TABLE public.platform_user_roles ADD CONSTRAINT fk_core_056 FOREIGN KEY (user_id) REFERENCES public.app_users (id) ON DELETE RESTRICT;

ALTER TABLE public.lot_staff_assignments ADD CONSTRAINT ck_assignment_validity CHECK (valid_until IS NULL OR valid_until > valid_from),
  ADD CONSTRAINT ck_facility_role CHECK (role_code IN ('PARKING_STAFF','PARKING_MANAGER'));

ALTER TABLE public.auth_tokens ADD CONSTRAINT ck_auth_expiry CHECK (expires_at > created_at);

CREATE FUNCTION public.reject_immutable_write() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only; insert corrections instead', TG_TABLE_NAME USING ERRCODE = '23514';
END $$;

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

ALTER TABLE public.lot_staff_assignments ADD COLUMN can_manage_staff_assignments boolean NOT NULL DEFAULT false;

COMMIT;
