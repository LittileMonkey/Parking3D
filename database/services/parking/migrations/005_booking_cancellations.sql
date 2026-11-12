BEGIN;
CREATE TABLE IF NOT EXISTS booking_cancellations (
  booking_id uuid PRIMARY KEY REFERENCES bookings(id),
  lot_id uuid NOT NULL REFERENCES parking_lots(id),
  requested_by uuid NOT NULL,
  reason text NOT NULL,
  requested_at timestamptz NOT NULL,
  refund_eligible boolean NOT NULL,
  refund_status text NOT NULL CHECK(refund_status IN ('REVIEW_REQUIRED','NOT_ELIGIBLE','COMPLETED'))
);
COMMIT;
