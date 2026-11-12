BEGIN;
ALTER TABLE lot_vehicle_policies ADD COLUMN IF NOT EXISTS grace_free_minutes int NOT NULL DEFAULT 15 CHECK(grace_free_minutes BETWEEN 0 AND 15);
ALTER TABLE parking_sessions ADD COLUMN IF NOT EXISTS customer_id uuid;
ALTER TABLE parking_sessions ADD COLUMN IF NOT EXISTS grace_minutes int NOT NULL DEFAULT 0 CHECK(grace_minutes BETWEEN 0 AND 15);
CREATE TABLE IF NOT EXISTS daily_grace_claims (
 user_id uuid NOT NULL, local_day date NOT NULL, booking_id uuid REFERENCES bookings(id) DEFERRABLE INITIALLY DEFERRED,
 session_id uuid REFERENCES parking_sessions(id) DEFERRABLE INITIALLY DEFERRED, minutes int NOT NULL CHECK(minutes BETWEEN 0 AND 15),
 PRIMARY KEY(user_id,local_day), UNIQUE(booking_id), UNIQUE(session_id)
);
CREATE OR REPLACE FUNCTION assign_session_grace() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE owner_id uuid; grant_minutes int; configured int;
BEGIN
 IF NEW.booking_id IS NOT NULL THEN
  SELECT customer_id INTO owner_id FROM bookings WHERE id=NEW.booking_id;
  UPDATE daily_grace_claims SET session_id=NEW.id WHERE booking_id=NEW.booking_id RETURNING minutes INTO grant_minutes;
 ELSE
  SELECT CASE WHEN count(*)=1 THEN (array_agg(user_id))[1] ELSE NULL END INTO owner_id
   FROM user_vehicle_access WHERE vehicle_id=NEW.vehicle_id AND verified_at IS NOT NULL AND revoked_at IS NULL;
  IF owner_id IS NOT NULL THEN
   SELECT grace_free_minutes INTO configured FROM lot_vehicle_policies WHERE lot_id=NEW.lot_id AND vehicle_type=NEW.vehicle_type;
   IF configured>0 THEN
    INSERT INTO daily_grace_claims(user_id,local_day,session_id,minutes)
    VALUES(owner_id,(NEW.entry_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date,NEW.id,configured)
    ON CONFLICT DO NOTHING RETURNING minutes INTO grant_minutes;
   END IF;
  END IF;
 END IF;
 NEW.customer_id=owner_id;NEW.grace_minutes=coalesce(grant_minutes,0);RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tr_session_grace ON parking_sessions;
CREATE TRIGGER tr_session_grace BEFORE INSERT ON parking_sessions FOR EACH ROW EXECUTE FUNCTION assign_session_grace();
CREATE OR REPLACE FUNCTION release_unused_booking_grace() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.status IN ('CANCELLED','EXPIRED','NO_SHOW') THEN
  DELETE FROM daily_grace_claims WHERE booking_id=NEW.id AND session_id IS NULL;
 END IF;
 RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS tr_booking_release_grace ON bookings;
CREATE TRIGGER tr_booking_release_grace AFTER UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION release_unused_booking_grace();
COMMIT;
