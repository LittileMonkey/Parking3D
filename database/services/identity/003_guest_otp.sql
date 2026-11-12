BEGIN;
CREATE TABLE IF NOT EXISTS guest_login_challenges (
 email text PRIMARY KEY, otp_hash text NOT NULL, expires_at timestamptz NOT NULL,
 sent_at timestamptz NOT NULL, failures int NOT NULL DEFAULT 0,
 locked_until timestamptz, consumed_at timestamptz
);
COMMIT;
