BEGIN;
CREATE OR REPLACE FUNCTION publish_reservation_slot_change() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE changed_slot uuid;
BEGIN
  FOR changed_slot IN
    SELECT DISTINCT id FROM unnest(CASE WHEN TG_OP='INSERT' THEN ARRAY[NEW.slot_id]
      WHEN TG_OP='DELETE' THEN ARRAY[OLD.slot_id] ELSE ARRAY[OLD.slot_id,NEW.slot_id] END) AS ids(id)
  LOOP
    INSERT INTO integration_outbox(event_id,event_type,aggregate_id,payload,occurred_at)
    SELECT gen_random_uuid(),'SlotStatusChanged.v1',s.id,
      jsonb_build_object('parkingLotId',s.lot_id,'slotId',s.id,'observedAt',clock_timestamp()),clock_timestamp()
    FROM parking_slots s WHERE s.id=changed_slot;
  END LOOP;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS tr_reservation_slot_events ON slot_reservations;
CREATE TRIGGER tr_reservation_slot_events AFTER INSERT OR UPDATE OR DELETE ON slot_reservations
FOR EACH ROW EXECUTE FUNCTION publish_reservation_slot_change();
COMMIT;
