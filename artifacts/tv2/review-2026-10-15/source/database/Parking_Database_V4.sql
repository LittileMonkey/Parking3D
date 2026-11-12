-- Full PostgreSQL 17 schema: 42 core tables + 5 AI tables.

-- Run ONCE on an EMPTY dedicated database. Never mix with EF PascalCase schema.

-- Generated core from Parking_Database_V4.dbml; reviewed guards and AI DDL follow.

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

CREATE TABLE public.app_settings (
    key text NOT NULL PRIMARY KEY,
    value jsonb NOT NULL,
    updated_by uuid,
    updated_at timestamptz NOT NULL DEFAULT now()
);

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

CREATE TABLE public.vehicle_types (
    code text NOT NULL PRIMARY KEY,
    name text NOT NULL
);

CREATE TABLE public.vehicles (
    id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    plate_country char(2) NOT NULL,
    plate_normalized varchar(20) NOT NULL,
    vehicle_type text NOT NULL,
    fuel_type text NOT NULL,
    is_active boolean NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (id, vehicle_type),
    UNIQUE (plate_country, plate_normalized)
);

CREATE TABLE public.user_vehicle_access (
    user_id uuid NOT NULL,
    vehicle_id uuid NOT NULL,
    access_kind text NOT NULL,
    verified_at timestamptz,
    is_primary boolean NOT NULL,
    revoked_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, vehicle_id)
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

CREATE TABLE public.parking_lots (
    id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(30) NOT NULL UNIQUE,
    name text NOT NULL,
    address text NOT NULL,
    latitude numeric(9,6) NOT NULL,
    longitude numeric(9,6) NOT NULL,
    timezone text NOT NULL,
    status text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.lot_vehicle_policies (
    lot_id uuid NOT NULL,
    vehicle_type text NOT NULL,
    guest_booking_enabled boolean NOT NULL,
    dynamic_multiplier_cap numeric(6,3) NOT NULL,
    hold_minutes int NOT NULL,
    min_booking_minutes int NOT NULL,
    max_booking_minutes int NOT NULL,
    early_arrival_minutes int NOT NULL,
    late_arrival_minutes int NOT NULL,
    warning_percent numeric(5,2) NOT NULL,
    admission_percent numeric(5,2) NOT NULL,
    reserved_capacity int NOT NULL,
    cancellation_refund_cutoff_minutes int NOT NULL,
    PRIMARY KEY (lot_id, vehicle_type)
);

CREATE TABLE public.lot_opening_intervals (
    id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    lot_id uuid NOT NULL,
    start_minute int NOT NULL,
    end_minute int NOT NULL
);

CREATE TABLE public.lot_closures (
    id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    lot_id uuid NOT NULL,
    starts_at timestamptz NOT NULL,
    ends_at timestamptz NOT NULL,
    reason text NOT NULL
);

CREATE TABLE public.lot_gates (
    id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    lot_id uuid NOT NULL,
    code text NOT NULL,
    gate_kind text NOT NULL,
    latitude numeric(9,6),
    longitude numeric(9,6),
    UNIQUE (id, lot_id),
    UNIQUE (lot_id, code)
);

CREATE TABLE public.parking_levels (
    id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    lot_id uuid NOT NULL,
    code varchar(30) NOT NULL,
    name text NOT NULL,
    level_kind text NOT NULL,
    elevation_m numeric(8,3) NOT NULL,
    display_order int NOT NULL,
    UNIQUE (id, lot_id),
    UNIQUE (lot_id, code)
);

CREATE TABLE public.zones (
    id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    lot_id uuid NOT NULL,
    level_id uuid NOT NULL,
    code varchar(30) NOT NULL,
    name text NOT NULL,
    UNIQUE (id, lot_id),
    UNIQUE (id, lot_id, level_id),
    UNIQUE (level_id, code)
);

CREATE TABLE public.parking_slots (
    id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    lot_id uuid NOT NULL,
    zone_id uuid NOT NULL,
    level_id uuid NOT NULL,
    code varchar(30) NOT NULL,
    operational_status public.slot_operational_status NOT NULL,
    width_m numeric(6,2),
    length_m numeric(6,2),
    UNIQUE (id, lot_id),
    UNIQUE (zone_id, code),
    UNIQUE (id, lot_id, level_id)
);

CREATE TABLE public.slot_vehicle_types (
    slot_id uuid NOT NULL,
    lot_id uuid NOT NULL,
    vehicle_type text NOT NULL,
    PRIMARY KEY (slot_id, lot_id, vehicle_type)
);

CREATE TABLE public.slot_features (
    code text NOT NULL PRIMARY KEY,
    name text NOT NULL
);

CREATE TABLE public.slot_feature_links (
    slot_id uuid NOT NULL,
    feature_code text NOT NULL,
    PRIMARY KEY (slot_id, feature_code)
);

CREATE TABLE public.map_versions (
    id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    lot_id uuid NOT NULL,
    version_no int NOT NULL,
    status public.map_version_status NOT NULL,
    coordinate_unit text NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    published_at timestamptz,
    UNIQUE (id, lot_id),
    UNIQUE (lot_id, version_no)
);

CREATE TABLE public.map_objects (
    id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    lot_id uuid NOT NULL,
    map_version_id uuid NOT NULL,
    level_id uuid NOT NULL,
    slot_id uuid,
    gate_id uuid,
    object_type text NOT NULL,
    x numeric(10,3) NOT NULL,
    y numeric(10,3) NOT NULL,
    z numeric(10,3) NOT NULL,
    rotation_y numeric(9,4) NOT NULL,
    size_x numeric(10,3) NOT NULL,
    size_y numeric(10,3) NOT NULL,
    size_z numeric(10,3) NOT NULL,
    metadata jsonb NOT NULL,
    UNIQUE (map_version_id, slot_id)
);

CREATE TABLE public.bookings (
    id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(30) NOT NULL UNIQUE,
    lot_id uuid NOT NULL,
    vehicle_id uuid NOT NULL,
    vehicle_type text NOT NULL,
    customer_id uuid,
    guest_contact text,
    plate_snapshot text NOT NULL,
    mode public.booking_mode NOT NULL,
    starts_at timestamptz NOT NULL,
    ends_at timestamptz NOT NULL,
    hold_expires_at timestamptz,
    arrival_deadline timestamptz NOT NULL,
    status public.booking_status NOT NULL,
    pricing_snapshot_id uuid NOT NULL,
    estimated_amount numeric(18,0) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    cancelled_at timestamptz,
    cancellation_reason text,
    UNIQUE (id, lot_id),
    UNIQUE (id, lot_id, vehicle_id),
    UNIQUE (id, lot_id, vehicle_type, starts_at, ends_at)
);

CREATE TABLE public.slot_reservations (
    id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id uuid NOT NULL,
    lot_id uuid NOT NULL,
    slot_id uuid NOT NULL,
    vehicle_type text NOT NULL,
    starts_at timestamptz NOT NULL,
    ends_at timestamptz NOT NULL,
    status public.reservation_status NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    released_at timestamptz,
    release_reason text
);

CREATE TABLE public.qr_tokens (
    id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id uuid NOT NULL,
    nonce_hash text NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL,
    consumed_at timestamptz,
    revoked_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.parking_sessions (
    id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    lot_id uuid NOT NULL,
    vehicle_id uuid NOT NULL,
    vehicle_type text NOT NULL,
    booking_id uuid UNIQUE,
    pricing_snapshot_id uuid NOT NULL,
    plate_snapshot text NOT NULL,
    entry_gate_id uuid,
    exit_gate_id uuid,
    entry_at timestamptz NOT NULL,
    expected_exit_at timestamptz NOT NULL,
    exit_at timestamptz,
    status public.session_status NOT NULL,
    entry_method text NOT NULL,
    entered_by uuid,
    exited_by uuid,
    UNIQUE (id, lot_id),
    UNIQUE (id, lot_id, vehicle_id),
    UNIQUE (id, lot_id, vehicle_type)
);

CREATE TABLE public.session_slot_assignments (
    id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id uuid NOT NULL,
    lot_id uuid NOT NULL,
    slot_id uuid NOT NULL,
    vehicle_type text NOT NULL,
    occupied_from timestamptz NOT NULL,
    vacated_at timestamptz,
    assigned_by uuid,
    reason text
);

CREATE TABLE public.pricing_plans (
    id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    lot_id uuid NOT NULL,
    vehicle_type text NOT NULL,
    version_no int NOT NULL,
    name text NOT NULL,
    status text NOT NULL,
    effective_from timestamptz NOT NULL,
    effective_until timestamptz,
    currency char(3) NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (id, lot_id),
    UNIQUE (id, lot_id, vehicle_type),
    UNIQUE (lot_id, vehicle_type, version_no)
);

CREATE TABLE public.pricing_rules (
    id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id uuid NOT NULL,
    lot_id uuid NOT NULL,
    zone_id uuid,
    rule_type text NOT NULL,
    priority int NOT NULL,
    amount numeric(18,0),
    billing_unit_minutes int,
    multiplier numeric(6,3),
    parameters jsonb NOT NULL,
    UNIQUE (plan_id, priority)
);

CREATE TABLE public.pricing_snapshots (
    id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    lot_id uuid NOT NULL,
    plan_id uuid NOT NULL,
    vehicle_type text NOT NULL,
    engine_version text NOT NULL,
    resolved_rules jsonb NOT NULL,
    policy_snapshot jsonb NOT NULL,
    currency char(3) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (id, lot_id),
    UNIQUE (id, lot_id, vehicle_type)
);

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

CREATE TABLE public.devices (
    id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    lot_id uuid NOT NULL,
    gate_id uuid,
    slot_id uuid,
    code text NOT NULL,
    device_type text NOT NULL,
    api_key_hash text,
    enabled boolean NOT NULL,
    UNIQUE (id, lot_id),
    UNIQUE (lot_id, code)
);

CREATE TABLE public.device_events (
    id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id uuid NOT NULL,
    lot_id uuid NOT NULL,
    external_event_id text NOT NULL,
    slot_id uuid,
    event_type text NOT NULL,
    occurred_at timestamptz NOT NULL,
    received_at timestamptz NOT NULL,
    confidence numeric(5,4),
    payload jsonb NOT NULL,
    processing_status text NOT NULL,
    UNIQUE (device_id, external_event_id),
    UNIQUE (id, lot_id)
);

CREATE TABLE public.slot_observations (
    slot_id uuid NOT NULL PRIMARY KEY,
    lot_id uuid NOT NULL,
    event_id uuid,
    occupancy text NOT NULL,
    observed_at timestamptz NOT NULL,
    verified_by uuid
);

CREATE TABLE public.parking_issues (
    id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    lot_id uuid NOT NULL,
    session_id uuid,
    booking_id uuid,
    device_event_id uuid,
    issue_type text NOT NULL,
    status text NOT NULL,
    reason text NOT NULL,
    resolution text,
    reported_by uuid,
    approved_by uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    resolved_at timestamptz,
    UNIQUE (id, lot_id)
);

CREATE TABLE public.notifications (
    id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    lot_id uuid,
    recipient_user_id uuid,
    recipient_contact text,
    channel text NOT NULL,
    template_code text NOT NULL,
    payload jsonb NOT NULL,
    dedupe_key text NOT NULL UNIQUE,
    delivery_status text NOT NULL,
    read_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.outbox_events (
    id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    lot_id uuid,
    event_type text NOT NULL,
    aggregate_id uuid NOT NULL,
    payload jsonb NOT NULL,
    occurred_at timestamptz NOT NULL,
    published_at timestamptz,
    attempts int NOT NULL
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

ALTER TABLE public.app_settings ADD CONSTRAINT fk_core_001 FOREIGN KEY (updated_by) REFERENCES public.app_users (id) ON DELETE RESTRICT;

ALTER TABLE public.audit_logs ADD CONSTRAINT fk_core_002 FOREIGN KEY (actor_user_id) REFERENCES public.app_users (id) ON DELETE RESTRICT;

ALTER TABLE public.audit_logs ADD CONSTRAINT fk_core_003 FOREIGN KEY (lot_id) REFERENCES public.parking_lots (id) ON DELETE RESTRICT;

ALTER TABLE public.auth_tokens ADD CONSTRAINT fk_core_004 FOREIGN KEY (user_id) REFERENCES public.app_users (id) ON DELETE RESTRICT;

ALTER TABLE public.billing_accounts ADD CONSTRAINT fk_core_005 FOREIGN KEY (booking_id, lot_id, vehicle_id) REFERENCES public.bookings (id, lot_id, vehicle_id) ON DELETE RESTRICT;

ALTER TABLE public.billing_accounts ADD CONSTRAINT fk_core_006 FOREIGN KEY (session_id, lot_id, vehicle_id) REFERENCES public.parking_sessions (id, lot_id, vehicle_id) ON DELETE RESTRICT;

ALTER TABLE public.billing_lines ADD CONSTRAINT fk_core_007 FOREIGN KEY (account_id) REFERENCES public.billing_accounts (id) ON DELETE RESTRICT;

ALTER TABLE public.billing_lines ADD CONSTRAINT fk_core_008 FOREIGN KEY (created_by) REFERENCES public.app_users (id) ON DELETE RESTRICT;

ALTER TABLE public.bookings ADD CONSTRAINT fk_core_009 FOREIGN KEY (customer_id) REFERENCES public.app_users (id) ON DELETE RESTRICT;

ALTER TABLE public.bookings ADD CONSTRAINT fk_core_010 FOREIGN KEY (lot_id, vehicle_type) REFERENCES public.lot_vehicle_policies (lot_id, vehicle_type) ON DELETE RESTRICT;

ALTER TABLE public.bookings ADD CONSTRAINT fk_core_011 FOREIGN KEY (pricing_snapshot_id, lot_id, vehicle_type) REFERENCES public.pricing_snapshots (id, lot_id, vehicle_type) ON DELETE RESTRICT;

ALTER TABLE public.bookings ADD CONSTRAINT fk_core_012 FOREIGN KEY (vehicle_id, vehicle_type) REFERENCES public.vehicles (id, vehicle_type) ON DELETE RESTRICT;

ALTER TABLE public.device_events ADD CONSTRAINT fk_core_013 FOREIGN KEY (device_id, lot_id) REFERENCES public.devices (id, lot_id) ON DELETE RESTRICT;

ALTER TABLE public.device_events ADD CONSTRAINT fk_core_014 FOREIGN KEY (slot_id, lot_id) REFERENCES public.parking_slots (id, lot_id) ON DELETE RESTRICT;

ALTER TABLE public.devices ADD CONSTRAINT fk_core_015 FOREIGN KEY (gate_id, lot_id) REFERENCES public.lot_gates (id, lot_id) ON DELETE RESTRICT;

ALTER TABLE public.devices ADD CONSTRAINT fk_core_016 FOREIGN KEY (lot_id) REFERENCES public.parking_lots (id) ON DELETE RESTRICT;

ALTER TABLE public.devices ADD CONSTRAINT fk_core_017 FOREIGN KEY (slot_id, lot_id) REFERENCES public.parking_slots (id, lot_id) ON DELETE RESTRICT;

ALTER TABLE public.lot_closures ADD CONSTRAINT fk_core_018 FOREIGN KEY (lot_id) REFERENCES public.parking_lots (id) ON DELETE RESTRICT;

ALTER TABLE public.lot_gates ADD CONSTRAINT fk_core_019 FOREIGN KEY (lot_id) REFERENCES public.parking_lots (id) ON DELETE RESTRICT;

ALTER TABLE public.lot_opening_intervals ADD CONSTRAINT fk_core_020 FOREIGN KEY (lot_id) REFERENCES public.parking_lots (id) ON DELETE RESTRICT;

ALTER TABLE public.lot_staff_assignments ADD CONSTRAINT fk_core_021 FOREIGN KEY (lot_id) REFERENCES public.parking_lots (id) ON DELETE RESTRICT;

ALTER TABLE public.lot_staff_assignments ADD CONSTRAINT fk_core_022 FOREIGN KEY (user_id) REFERENCES public.app_users (id) ON DELETE RESTRICT;

ALTER TABLE public.lot_vehicle_policies ADD CONSTRAINT fk_core_023 FOREIGN KEY (lot_id) REFERENCES public.parking_lots (id) ON DELETE RESTRICT;

ALTER TABLE public.lot_vehicle_policies ADD CONSTRAINT fk_core_024 FOREIGN KEY (vehicle_type) REFERENCES public.vehicle_types (code) ON DELETE RESTRICT;

ALTER TABLE public.map_objects ADD CONSTRAINT fk_core_025 FOREIGN KEY (gate_id, lot_id) REFERENCES public.lot_gates (id, lot_id) ON DELETE RESTRICT;

ALTER TABLE public.map_objects ADD CONSTRAINT fk_core_026 FOREIGN KEY (level_id, lot_id) REFERENCES public.parking_levels (id, lot_id) ON DELETE RESTRICT;

ALTER TABLE public.map_objects ADD CONSTRAINT fk_core_027 FOREIGN KEY (map_version_id, lot_id) REFERENCES public.map_versions (id, lot_id) ON DELETE RESTRICT;

ALTER TABLE public.map_objects ADD CONSTRAINT fk_core_028 FOREIGN KEY (slot_id, lot_id, level_id) REFERENCES public.parking_slots (id, lot_id, level_id) ON DELETE RESTRICT;

ALTER TABLE public.map_versions ADD CONSTRAINT fk_core_029 FOREIGN KEY (created_by) REFERENCES public.app_users (id) ON DELETE RESTRICT;

ALTER TABLE public.map_versions ADD CONSTRAINT fk_core_030 FOREIGN KEY (lot_id) REFERENCES public.parking_lots (id) ON DELETE RESTRICT;

ALTER TABLE public.notifications ADD CONSTRAINT fk_core_031 FOREIGN KEY (lot_id) REFERENCES public.parking_lots (id) ON DELETE RESTRICT;

ALTER TABLE public.notifications ADD CONSTRAINT fk_core_032 FOREIGN KEY (recipient_user_id) REFERENCES public.app_users (id) ON DELETE RESTRICT;

ALTER TABLE public.outbox_events ADD CONSTRAINT fk_core_033 FOREIGN KEY (lot_id) REFERENCES public.parking_lots (id) ON DELETE RESTRICT;

ALTER TABLE public.parking_issues ADD CONSTRAINT fk_core_034 FOREIGN KEY (approved_by) REFERENCES public.app_users (id) ON DELETE RESTRICT;

ALTER TABLE public.parking_issues ADD CONSTRAINT fk_core_035 FOREIGN KEY (booking_id, lot_id) REFERENCES public.bookings (id, lot_id) ON DELETE RESTRICT;

ALTER TABLE public.parking_issues ADD CONSTRAINT fk_core_036 FOREIGN KEY (device_event_id, lot_id) REFERENCES public.device_events (id, lot_id) ON DELETE RESTRICT;

ALTER TABLE public.parking_issues ADD CONSTRAINT fk_core_037 FOREIGN KEY (lot_id) REFERENCES public.parking_lots (id) ON DELETE RESTRICT;

ALTER TABLE public.parking_issues ADD CONSTRAINT fk_core_038 FOREIGN KEY (reported_by) REFERENCES public.app_users (id) ON DELETE RESTRICT;

ALTER TABLE public.parking_issues ADD CONSTRAINT fk_core_039 FOREIGN KEY (session_id, lot_id) REFERENCES public.parking_sessions (id, lot_id) ON DELETE RESTRICT;

ALTER TABLE public.parking_levels ADD CONSTRAINT fk_core_040 FOREIGN KEY (lot_id) REFERENCES public.parking_lots (id) ON DELETE RESTRICT;

ALTER TABLE public.parking_sessions ADD CONSTRAINT fk_core_041 FOREIGN KEY (booking_id, lot_id, vehicle_id) REFERENCES public.bookings (id, lot_id, vehicle_id) ON DELETE RESTRICT;

ALTER TABLE public.parking_sessions ADD CONSTRAINT fk_core_042 FOREIGN KEY (entered_by) REFERENCES public.app_users (id) ON DELETE RESTRICT;

ALTER TABLE public.parking_sessions ADD CONSTRAINT fk_core_043 FOREIGN KEY (entry_gate_id, lot_id) REFERENCES public.lot_gates (id, lot_id) ON DELETE RESTRICT;

ALTER TABLE public.parking_sessions ADD CONSTRAINT fk_core_044 FOREIGN KEY (exit_gate_id, lot_id) REFERENCES public.lot_gates (id, lot_id) ON DELETE RESTRICT;

ALTER TABLE public.parking_sessions ADD CONSTRAINT fk_core_045 FOREIGN KEY (exited_by) REFERENCES public.app_users (id) ON DELETE RESTRICT;

ALTER TABLE public.parking_sessions ADD CONSTRAINT fk_core_046 FOREIGN KEY (lot_id, vehicle_type) REFERENCES public.lot_vehicle_policies (lot_id, vehicle_type) ON DELETE RESTRICT;

ALTER TABLE public.parking_sessions ADD CONSTRAINT fk_core_047 FOREIGN KEY (pricing_snapshot_id, lot_id, vehicle_type) REFERENCES public.pricing_snapshots (id, lot_id, vehicle_type) ON DELETE RESTRICT;

ALTER TABLE public.parking_sessions ADD CONSTRAINT fk_core_048 FOREIGN KEY (vehicle_id, vehicle_type) REFERENCES public.vehicles (id, vehicle_type) ON DELETE RESTRICT;

ALTER TABLE public.parking_slots ADD CONSTRAINT fk_core_049 FOREIGN KEY (lot_id) REFERENCES public.parking_lots (id) ON DELETE RESTRICT;

ALTER TABLE public.parking_slots ADD CONSTRAINT fk_core_050 FOREIGN KEY (zone_id, lot_id, level_id) REFERENCES public.zones (id, lot_id, level_id) ON DELETE RESTRICT;

ALTER TABLE public.payment_attempts ADD CONSTRAINT fk_core_051 FOREIGN KEY (payment_id) REFERENCES public.payments (id) ON DELETE RESTRICT;

ALTER TABLE public.payment_webhook_events ADD CONSTRAINT fk_core_052 FOREIGN KEY (payment_attempt_id) REFERENCES public.payment_attempts (id) ON DELETE RESTRICT;

ALTER TABLE public.payment_webhook_events ADD CONSTRAINT fk_core_053 FOREIGN KEY (refund_id) REFERENCES public.refunds (id) ON DELETE RESTRICT;

ALTER TABLE public.payments ADD CONSTRAINT fk_core_054 FOREIGN KEY (account_id) REFERENCES public.billing_accounts (id) ON DELETE RESTRICT;

ALTER TABLE public.payments ADD CONSTRAINT fk_core_055 FOREIGN KEY (collected_by) REFERENCES public.app_users (id) ON DELETE RESTRICT;

ALTER TABLE public.platform_user_roles ADD CONSTRAINT fk_core_056 FOREIGN KEY (user_id) REFERENCES public.app_users (id) ON DELETE RESTRICT;

ALTER TABLE public.pricing_plans ADD CONSTRAINT fk_core_057 FOREIGN KEY (created_by) REFERENCES public.app_users (id) ON DELETE RESTRICT;

ALTER TABLE public.pricing_plans ADD CONSTRAINT fk_core_058 FOREIGN KEY (lot_id, vehicle_type) REFERENCES public.lot_vehicle_policies (lot_id, vehicle_type) ON DELETE RESTRICT;

ALTER TABLE public.pricing_rules ADD CONSTRAINT fk_core_059 FOREIGN KEY (plan_id, lot_id) REFERENCES public.pricing_plans (id, lot_id) ON DELETE RESTRICT;

ALTER TABLE public.pricing_rules ADD CONSTRAINT fk_core_060 FOREIGN KEY (zone_id, lot_id) REFERENCES public.zones (id, lot_id) ON DELETE RESTRICT;

ALTER TABLE public.pricing_snapshots ADD CONSTRAINT fk_core_061 FOREIGN KEY (plan_id, lot_id, vehicle_type) REFERENCES public.pricing_plans (id, lot_id, vehicle_type) ON DELETE RESTRICT;

ALTER TABLE public.qr_tokens ADD CONSTRAINT fk_core_062 FOREIGN KEY (booking_id) REFERENCES public.bookings (id) ON DELETE RESTRICT;

ALTER TABLE public.refunds ADD CONSTRAINT fk_core_063 FOREIGN KEY (approved_by) REFERENCES public.app_users (id) ON DELETE RESTRICT;

ALTER TABLE public.refunds ADD CONSTRAINT fk_core_064 FOREIGN KEY (payment_id) REFERENCES public.payments (id) ON DELETE RESTRICT;

ALTER TABLE public.refunds ADD CONSTRAINT fk_core_065 FOREIGN KEY (requested_by) REFERENCES public.app_users (id) ON DELETE RESTRICT;

ALTER TABLE public.session_slot_assignments ADD CONSTRAINT fk_core_066 FOREIGN KEY (assigned_by) REFERENCES public.app_users (id) ON DELETE RESTRICT;

ALTER TABLE public.session_slot_assignments ADD CONSTRAINT fk_core_067 FOREIGN KEY (session_id, lot_id, vehicle_type) REFERENCES public.parking_sessions (id, lot_id, vehicle_type) ON DELETE RESTRICT;

ALTER TABLE public.session_slot_assignments ADD CONSTRAINT fk_core_068 FOREIGN KEY (slot_id, lot_id, vehicle_type) REFERENCES public.slot_vehicle_types (slot_id, lot_id, vehicle_type) ON DELETE RESTRICT;

ALTER TABLE public.slot_feature_links ADD CONSTRAINT fk_core_069 FOREIGN KEY (feature_code) REFERENCES public.slot_features (code) ON DELETE RESTRICT;

ALTER TABLE public.slot_feature_links ADD CONSTRAINT fk_core_070 FOREIGN KEY (slot_id) REFERENCES public.parking_slots (id) ON DELETE RESTRICT;

ALTER TABLE public.slot_observations ADD CONSTRAINT fk_core_071 FOREIGN KEY (event_id, lot_id) REFERENCES public.device_events (id, lot_id) ON DELETE RESTRICT;

ALTER TABLE public.slot_observations ADD CONSTRAINT fk_core_072 FOREIGN KEY (slot_id, lot_id) REFERENCES public.parking_slots (id, lot_id) ON DELETE RESTRICT;

ALTER TABLE public.slot_observations ADD CONSTRAINT fk_core_073 FOREIGN KEY (verified_by) REFERENCES public.app_users (id) ON DELETE RESTRICT;

ALTER TABLE public.slot_reservations ADD CONSTRAINT fk_core_074 FOREIGN KEY (booking_id, lot_id, vehicle_type, starts_at, ends_at) REFERENCES public.bookings (id, lot_id, vehicle_type, starts_at, ends_at) ON DELETE RESTRICT;

ALTER TABLE public.slot_reservations ADD CONSTRAINT fk_core_075 FOREIGN KEY (slot_id, lot_id, vehicle_type) REFERENCES public.slot_vehicle_types (slot_id, lot_id, vehicle_type) ON DELETE RESTRICT;

ALTER TABLE public.slot_vehicle_types ADD CONSTRAINT fk_core_076 FOREIGN KEY (lot_id, vehicle_type) REFERENCES public.lot_vehicle_policies (lot_id, vehicle_type) ON DELETE RESTRICT;

ALTER TABLE public.slot_vehicle_types ADD CONSTRAINT fk_core_077 FOREIGN KEY (slot_id, lot_id) REFERENCES public.parking_slots (id, lot_id) ON DELETE RESTRICT;

ALTER TABLE public.user_vehicle_access ADD CONSTRAINT fk_core_078 FOREIGN KEY (user_id) REFERENCES public.app_users (id) ON DELETE RESTRICT;

ALTER TABLE public.user_vehicle_access ADD CONSTRAINT fk_core_079 FOREIGN KEY (vehicle_id) REFERENCES public.vehicles (id) ON DELETE RESTRICT;

ALTER TABLE public.vehicles ADD CONSTRAINT fk_core_080 FOREIGN KEY (vehicle_type) REFERENCES public.vehicle_types (code) ON DELETE RESTRICT;

ALTER TABLE public.zones ADD CONSTRAINT fk_core_081 FOREIGN KEY (level_id, lot_id) REFERENCES public.parking_levels (id, lot_id) ON DELETE RESTRICT;

ALTER TABLE public.zones ADD CONSTRAINT fk_core_082 FOREIGN KEY (lot_id) REFERENCES public.parking_lots (id) ON DELETE RESTRICT;

-- Included by Parking_Database_V4.sql. Not a separately ordered migration.
-- Policy-dependent values, RBAC and verified gateway signatures belong to services.
ALTER TABLE public.bookings ADD CONSTRAINT ck_booking_window CHECK (starts_at < ends_at),
  ADD CONSTRAINT ck_booking_price CHECK (estimated_amount >= 0),
  ADD CONSTRAINT ck_booking_identity CHECK (customer_id IS NOT NULL OR NULLIF(btrim(guest_contact),'') IS NOT NULL),
  ADD CONSTRAINT ck_booking_hold CHECK (status <> 'PENDING_PAYMENT' OR hold_expires_at IS NOT NULL);
ALTER TABLE public.slot_reservations ADD CONSTRAINT ck_reservation_window CHECK (starts_at < ends_at),
  ADD CONSTRAINT ck_reservation_release CHECK ((status = 'RELEASED') = (released_at IS NOT NULL));
ALTER TABLE public.bookings ADD CONSTRAINT ex_vehicle_booking_window EXCLUDE USING gist
  (vehicle_id WITH =, tstzrange(starts_at,ends_at,'[)') WITH &&)
  WHERE (status IN ('PENDING_PAYMENT','CONFIRMED'));
ALTER TABLE public.slot_reservations ADD CONSTRAINT ex_slot_reservation_window EXCLUDE USING gist
  (slot_id WITH =, tstzrange(starts_at,ends_at,'[)') WITH &&)
  WHERE (status IN ('HELD','CONFIRMED'));
CREATE UNIQUE INDEX ux_booking_effective_reservation ON public.slot_reservations(booking_id)
  WHERE status IN ('HELD','CONFIRMED');
ALTER TABLE public.session_slot_assignments ADD CONSTRAINT ck_assignment_window CHECK (vacated_at IS NULL OR vacated_at > occupied_from),
  ADD CONSTRAINT ex_slot_physical_window EXCLUDE USING gist
  (slot_id WITH =, tstzrange(occupied_from,vacated_at,'[)') WITH &&),
  ADD CONSTRAINT ex_session_physical_window EXCLUDE USING gist
  (session_id WITH =, tstzrange(occupied_from,vacated_at,'[)') WITH &&);
CREATE UNIQUE INDEX ux_slot_open_assignment ON public.session_slot_assignments(slot_id) WHERE vacated_at IS NULL;
CREATE UNIQUE INDEX ux_session_open_assignment ON public.session_slot_assignments(session_id) WHERE vacated_at IS NULL;
CREATE UNIQUE INDEX ux_vehicle_active_session ON public.parking_sessions(vehicle_id) WHERE status IN ('ACTIVE','EXIT_PENDING');
ALTER TABLE public.parking_sessions ADD CONSTRAINT ck_session_times CHECK (expected_exit_at > entry_at AND (exit_at IS NULL OR exit_at >= entry_at)),
  ADD CONSTRAINT ck_physical_completion CHECK ((status = 'COMPLETED') = (exit_at IS NOT NULL));
ALTER TABLE public.lot_opening_intervals ADD CONSTRAINT ck_opening_minutes CHECK (0 <= start_minute AND start_minute < end_minute AND end_minute <= 10080),
  ADD CONSTRAINT ex_opening_intervals EXCLUDE USING gist (lot_id WITH =, int4range(start_minute,end_minute,'[)') WITH &&);
ALTER TABLE public.lot_closures ADD CONSTRAINT ck_closure_window CHECK (starts_at < ends_at);
ALTER TABLE public.lot_staff_assignments ADD CONSTRAINT ck_assignment_validity CHECK (valid_until IS NULL OR valid_until > valid_from),
  ADD CONSTRAINT ck_facility_role CHECK (role_code IN ('PARKING_STAFF','PARKING_MANAGER'));
ALTER TABLE public.parking_lots ADD CONSTRAINT ck_lot_gps CHECK (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180);
ALTER TABLE public.parking_slots ADD CONSTRAINT ck_slot_dimensions CHECK ((width_m IS NULL OR width_m > 0) AND (length_m IS NULL OR length_m > 0));
ALTER TABLE public.vehicles ADD CONSTRAINT ck_normalized_plate CHECK (plate_normalized ~ '^[A-Z0-9]{1,20}$');
ALTER TABLE public.lot_vehicle_policies ADD CONSTRAINT ck_lot_policy CHECK
  (hold_minutes > 0 AND min_booking_minutes > 0 AND max_booking_minutes >= min_booking_minutes
   AND early_arrival_minutes >= 0 AND late_arrival_minutes >= 0 AND reserved_capacity >= 0
   AND cancellation_refund_cutoff_minutes >= 0 AND dynamic_multiplier_cap >= 1
   AND warning_percent BETWEEN 0 AND 100 AND admission_percent BETWEEN warning_percent AND 100);
ALTER TABLE public.pricing_plans ADD CONSTRAINT ck_plan_version CHECK (version_no > 0),
  ADD CONSTRAINT ck_plan_window CHECK (effective_until IS NULL OR effective_until > effective_from);
ALTER TABLE public.pricing_rules ADD CONSTRAINT ck_rule_values CHECK
  ((amount IS NULL OR amount >= 0) AND (billing_unit_minutes IS NULL OR billing_unit_minutes > 0) AND (multiplier IS NULL OR multiplier > 0));
ALTER TABLE public.qr_tokens ADD CONSTRAINT ck_qr_expiry CHECK (expires_at > created_at),
  ADD CONSTRAINT ck_qr_consume_time CHECK (consumed_at IS NULL OR consumed_at >= created_at);
ALTER TABLE public.auth_tokens ADD CONSTRAINT ck_auth_expiry CHECK (expires_at > created_at);
ALTER TABLE public.billing_accounts ADD CONSTRAINT ck_billing_visit CHECK (booking_id IS NOT NULL OR session_id IS NOT NULL);
ALTER TABLE public.payments ADD CONSTRAINT ck_payment_positive CHECK (amount > 0),
  ADD CONSTRAINT ck_payment_key CHECK (btrim(idempotency_key) <> ''),
  ADD CONSTRAINT ck_success_timestamp CHECK (status NOT IN ('SUCCESS','PARTIALLY_REFUNDED','REFUNDED') OR succeeded_at IS NOT NULL),
  ADD CONSTRAINT ck_cash_actor CHECK (method <> 'CASH' OR status NOT IN ('SUCCESS','PARTIALLY_REFUNDED','REFUNDED') OR collected_by IS NOT NULL);
ALTER TABLE public.refunds ADD CONSTRAINT ck_refund_positive CHECK (amount > 0),
  ADD CONSTRAINT ck_refund_key CHECK (btrim(idempotency_key) <> '');
ALTER TABLE public.billing_lines ADD CONSTRAINT ck_billing_source CHECK (btrim(source_key) <> '');
ALTER TABLE public.map_objects ADD CONSTRAINT ck_map_slot CHECK ((object_type = 'PARKING_SLOT') = (slot_id IS NOT NULL)),
  ADD CONSTRAINT ck_map_dimensions CHECK (size_x > 0 AND size_y > 0 AND size_z > 0);

-- Every active session must have exactly one open physical assignment at COMMIT.
-- This permits check-in, movement and physical exit to change both rows atomically.
CREATE FUNCTION public.check_session_occupancy() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE sid uuid; sid_old uuid; st public.session_status; n bigint;
BEGIN
  IF TG_TABLE_NAME = 'parking_sessions' THEN
    IF TG_OP <> 'DELETE' THEN sid := NEW.id; END IF;
    IF TG_OP <> 'INSERT' THEN sid_old := OLD.id; END IF;
  ELSE
    IF TG_OP <> 'DELETE' THEN sid := NEW.session_id; END IF;
    IF TG_OP <> 'INSERT' THEN sid_old := OLD.session_id; END IF;
  END IF;
  FOR sid IN SELECT DISTINCT v FROM unnest(ARRAY[sid,sid_old]) v WHERE v IS NOT NULL LOOP
    SELECT status INTO st FROM public.parking_sessions WHERE id = sid FOR UPDATE;
    IF FOUND THEN
      SELECT count(*) INTO n FROM public.session_slot_assignments WHERE session_id = sid AND vacated_at IS NULL;
      IF (st IN ('ACTIVE','EXIT_PENDING') AND n <> 1) OR (st = 'COMPLETED' AND n <> 0) THEN
        RAISE EXCEPTION 'Session physical occupancy inconsistent: %', sid USING ERRCODE = '23514';
      END IF;
    END IF;
  END LOOP;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER ct_session_occupancy AFTER INSERT OR UPDATE OR DELETE ON public.parking_sessions
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.check_session_occupancy();
CREATE CONSTRAINT TRIGGER ct_assignment_occupancy AFTER INSERT OR UPDATE OR DELETE ON public.session_slot_assignments
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.check_session_occupancy();

CREATE FUNCTION public.check_billing_visit() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE expected_booking uuid;
BEGIN
  IF NEW.booking_id IS NOT NULL AND NEW.session_id IS NOT NULL THEN
    SELECT booking_id INTO expected_booking FROM public.parking_sessions WHERE id = NEW.session_id FOR SHARE;
    IF expected_booking IS DISTINCT FROM NEW.booking_id THEN
      RAISE EXCEPTION 'Billing booking/session are not the same visit' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER tr_billing_same_visit BEFORE INSERT OR UPDATE ON public.billing_accounts
  FOR EACH ROW EXECUTE FUNCTION public.check_billing_visit();
-- A session's visit identity cannot be reassigned after creation.
CREATE FUNCTION public.protect_session_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(OLD.booking_id,OLD.vehicle_id,OLD.lot_id,OLD.vehicle_type) IS DISTINCT FROM
     ROW(NEW.booking_id,NEW.vehicle_id,NEW.lot_id,NEW.vehicle_type) THEN
    RAISE EXCEPTION 'Session visit identity is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER tr_session_identity BEFORE UPDATE ON public.parking_sessions
  FOR EACH ROW EXECUTE FUNCTION public.protect_session_identity();

CREATE FUNCTION public.reject_immutable_write() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only; insert corrections instead', TG_TABLE_NAME USING ERRCODE = '23514';
END $$;
CREATE TRIGGER tr_audit_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON public.audit_logs
  FOR EACH STATEMENT EXECUTE FUNCTION public.reject_immutable_write();
CREATE TRIGGER tr_billing_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON public.billing_lines
  FOR EACH STATEMENT EXECUTE FUNCTION public.reject_immutable_write();
CREATE TRIGGER tr_snapshot_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON public.pricing_snapshots
  FOR EACH STATEMENT EXECUTE FUNCTION public.reject_immutable_write();

-- Call in the SAME transaction before checking availability/changing a slot.
-- Lock vehicle first, then all slots in sorted UUID order to avoid deadlocks.
CREATE FUNCTION public.lock_parking_resource(resource_kind text, resource_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF resource_kind NOT IN ('VEHICLE','SLOT') OR resource_id IS NULL THEN
    RAISE EXCEPTION 'Invalid parking lock resource';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(resource_kind || ':' || resource_id::text,0));
END $$;


-- AI extension included in the SAME atomic schema transaction.

-- DESIGN DDL, PostgreSQL 17. Requires database-v3 core tables in public schema.
-- Not compatible with the current PascalCase EF schema or old ParkingProject prototype.
-- Does not create core schema. Apply once through an implementation migration after review.
-- No automatic connection or execution is performed by adding this file.

-- Fail before adding tables if prerequisite core tables/keys are absent or incompatible.
DO $$
BEGIN
    IF to_regclass('public.parking_lots') IS NULL
       OR to_regclass('public.app_users') IS NULL
       OR to_regclass('public.lot_vehicle_policies') IS NULL THEN
        RAISE EXCEPTION 'AI extension requires public snake_case V3 core; do not apply to prototype/PascalCase schema';
    END IF;
END $$;

CREATE TABLE public.ai_plate_recognitions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lot_id uuid NOT NULL REFERENCES public.parking_lots(id) ON DELETE RESTRICT,
    uploaded_by uuid NOT NULL REFERENCES public.app_users(id) ON DELETE RESTRICT,
    idempotency_key varchar(128) NOT NULL CHECK (btrim(idempotency_key) <> ''),
    image_sha256 varchar(64) NOT NULL CHECK (image_sha256 ~ '^[0-9a-f]{64}$'),
    image_object_key text CHECK (image_object_key IS NULL OR btrim(image_object_key) <> ''),
    candidate_plate varchar(20) CHECK (candidate_plate IS NULL OR candidate_plate ~ '^[A-Z0-9]{1,20}$'),
    confidence numeric(6,5) CHECK (confidence BETWEEN 0 AND 1),
    status text NOT NULL CHECK (status IN ('PROCESSING','PENDING_REVIEW','NO_PLATE','FAILED','REVIEWED','CONSUMED')),
    model_version text NOT NULL CHECK (btrim(model_version) <> ''),
    reviewed_plate varchar(20) CHECK (reviewed_plate IS NULL OR reviewed_plate ~ '^[A-Z0-9]{1,20}$'),
    reviewed_by uuid REFERENCES public.app_users(id) ON DELETE RESTRICT,
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
    FOREIGN KEY (lot_id, vehicle_type) REFERENCES public.lot_vehicle_policies(lot_id, vehicle_type) ON DELETE RESTRICT,
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
    FOREIGN KEY (lot_id, vehicle_type) REFERENCES public.lot_vehicle_policies(lot_id, vehicle_type) ON DELETE RESTRICT,
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
    lot_id uuid REFERENCES public.parking_lots(id) ON DELETE RESTRICT,
    document_key varchar(128) NOT NULL CHECK (btrim(document_key) <> ''),
    revision int NOT NULL CHECK (revision > 0),
    title text NOT NULL CHECK (btrim(title) <> ''),
    language varchar(10) NOT NULL DEFAULT 'vi' CHECK (language = 'vi'),
    visibility text NOT NULL DEFAULT 'PUBLIC' CHECK (visibility = 'PUBLIC'),
    status text NOT NULL CHECK (status IN ('DRAFT','PUBLISHED','ARCHIVED')),
    source_reference text NOT NULL CHECK (btrim(source_reference) <> ''),
    approved_by uuid REFERENCES public.app_users(id) ON DELETE RESTRICT,
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

-- Deliberately no AI trigger mutates Booking, Session, Payment, Reservation, Slot or AuditLog.
-- Application enforces facility RBAC, review transitions, publication revision workflow,
-- storage cleanup, freshness, and increments version/updated_at on writes.
-- These checks constrain row shape; they do not constitute an authorization mechanism.


COMMIT;
