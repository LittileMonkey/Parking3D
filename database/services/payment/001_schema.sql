-- Owned database: payment; run ONCE on an empty Development database.

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

CREATE TABLE public.billing_accounts (
    id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    lot_id uuid NOT NULL,
    vehicle_id uuid NOT NULL,
    booking_id uuid UNIQUE,
    session_id uuid UNIQUE,
    currency char(3) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (id, lot_id)
);

CREATE TABLE public.billing_lines (
    id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id uuid NOT NULL,
    line_kind text NOT NULL,
    amount numeric(18,0) NOT NULL,
    description text NOT NULL,
    source_key text NOT NULL,
    calculation jsonb NOT NULL,
    created_by uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (account_id, source_key)
);

CREATE TABLE public.payments (
    id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id uuid NOT NULL,
    amount numeric(18,0) NOT NULL,
    method public.payment_method NOT NULL,
    status public.payment_status NOT NULL,
    idempotency_key text NOT NULL UNIQUE,
    collected_by uuid,
    succeeded_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.payment_attempts (
    id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id uuid NOT NULL,
    provider text NOT NULL,
    merchant_reference text NOT NULL,
    provider_transaction_id text,
    status text NOT NULL,
    requested_at timestamptz NOT NULL,
    completed_at timestamptz,
    response_code text,
    UNIQUE (provider, merchant_reference),
    UNIQUE (provider, provider_transaction_id)
);

CREATE TABLE public.payment_webhook_events (
    id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    provider text NOT NULL,
    event_key text NOT NULL,
    payment_attempt_id uuid,
    received_at timestamptz NOT NULL,
    processed_at timestamptz,
    status text NOT NULL,
    sanitized_payload jsonb NOT NULL,
    refund_id uuid,
    UNIQUE (provider, event_key)
);

CREATE TABLE public.refunds (
    id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id uuid NOT NULL,
    amount numeric(18,0) NOT NULL,
    status text NOT NULL,
    idempotency_key text NOT NULL UNIQUE,
    provider_reference text UNIQUE,
    reason text NOT NULL,
    requested_by uuid,
    approved_by uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    succeeded_at timestamptz
);

ALTER TABLE public.billing_lines ADD CONSTRAINT fk_core_007 FOREIGN KEY (account_id) REFERENCES public.billing_accounts (id) ON DELETE RESTRICT;

ALTER TABLE public.payment_attempts ADD CONSTRAINT fk_core_051 FOREIGN KEY (payment_id) REFERENCES public.payments (id) ON DELETE RESTRICT;

ALTER TABLE public.payment_webhook_events ADD CONSTRAINT fk_core_052 FOREIGN KEY (payment_attempt_id) REFERENCES public.payment_attempts (id) ON DELETE RESTRICT;

ALTER TABLE public.payment_webhook_events ADD CONSTRAINT fk_core_053 FOREIGN KEY (refund_id) REFERENCES public.refunds (id) ON DELETE RESTRICT;

ALTER TABLE public.payments ADD CONSTRAINT fk_core_054 FOREIGN KEY (account_id) REFERENCES public.billing_accounts (id) ON DELETE RESTRICT;

ALTER TABLE public.refunds ADD CONSTRAINT fk_core_064 FOREIGN KEY (payment_id) REFERENCES public.payments (id) ON DELETE RESTRICT;

ALTER TABLE public.billing_accounts ADD CONSTRAINT ck_billing_visit CHECK (booking_id IS NOT NULL OR session_id IS NOT NULL);

ALTER TABLE public.payments ADD CONSTRAINT ck_payment_positive CHECK (amount > 0),
  ADD CONSTRAINT ck_payment_key CHECK (btrim(idempotency_key) <> ''),
  ADD CONSTRAINT ck_success_timestamp CHECK (status NOT IN ('SUCCESS','PARTIALLY_REFUNDED','REFUNDED') OR succeeded_at IS NOT NULL),
  ADD CONSTRAINT ck_cash_actor CHECK (method <> 'CASH' OR status NOT IN ('SUCCESS','PARTIALLY_REFUNDED','REFUNDED') OR collected_by IS NOT NULL);

ALTER TABLE public.refunds ADD CONSTRAINT ck_refund_positive CHECK (amount > 0),
  ADD CONSTRAINT ck_refund_key CHECK (btrim(idempotency_key) <> '');

ALTER TABLE public.billing_lines ADD CONSTRAINT ck_billing_source CHECK (btrim(source_key) <> '');

CREATE FUNCTION public.reject_immutable_write() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only; insert corrections instead', TG_TABLE_NAME USING ERRCODE = '23514';
END $$;

CREATE TRIGGER tr_billing_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON public.billing_lines
  FOR EACH STATEMENT EXECUTE FUNCTION public.reject_immutable_write();

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

ALTER TABLE public.payments ADD COLUMN version int NOT NULL DEFAULT 1 CHECK(version>0);

COMMIT;
