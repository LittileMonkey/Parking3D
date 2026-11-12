BEGIN;
CREATE TABLE IF NOT EXISTS user_notifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL,
 booking_id uuid REFERENCES bookings(id), kind text NOT NULL, message text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), read_at timestamptz,
 dedupe_key text NOT NULL UNIQUE
);
CREATE INDEX IF NOT EXISTS ix_notifications_user ON user_notifications(user_id,created_at DESC);
CREATE OR REPLACE FUNCTION notify_booking_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.customer_id IS NOT NULL AND (TG_OP='INSERT' OR NEW.status IS DISTINCT FROM OLD.status) THEN
  INSERT INTO user_notifications(user_id,booking_id,kind,message,dedupe_key)
  VALUES(NEW.customer_id,NEW.id,NEW.status::text,'Booking '||NEW.code||': '||NEW.status::text,
    NEW.id::text||':'||NEW.status::text) ON CONFLICT(dedupe_key) DO NOTHING;
 END IF;
 RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS tr_booking_notifications ON bookings;
CREATE TRIGGER tr_booking_notifications AFTER INSERT OR UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION notify_booking_change();
CREATE OR REPLACE FUNCTION notify_reservation_move() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.slot_id IS DISTINCT FROM OLD.slot_id THEN
  INSERT INTO user_notifications(user_id,booking_id,kind,message,dedupe_key)
  SELECT b.customer_id,b.id,'SLOT_CHANGED','Booking '||b.code||' chuyển sang ô '||s.code,
    NEW.id::text||':move:'||gen_random_uuid()::text FROM bookings b JOIN parking_slots s ON s.id=NEW.slot_id
  WHERE b.id=NEW.booking_id AND b.customer_id IS NOT NULL;
 END IF;
 RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS tr_reservation_notifications ON slot_reservations;
CREATE TRIGGER tr_reservation_notifications AFTER UPDATE ON slot_reservations FOR EACH ROW EXECUTE FUNCTION notify_reservation_move();
COMMIT;
