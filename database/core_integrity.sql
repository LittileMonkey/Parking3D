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
