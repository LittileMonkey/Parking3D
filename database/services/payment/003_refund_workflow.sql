BEGIN;
ALTER TABLE refunds ADD COLUMN IF NOT EXISTS provider_payload jsonb;
ALTER TABLE refunds ADD COLUMN IF NOT EXISTS last_error text;
ALTER TABLE refunds ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE payment_attempts ADD COLUMN IF NOT EXISTS provider_created_date text;
ALTER TABLE payment_attempts ADD COLUMN IF NOT EXISTS payment_url text;
COMMIT;
