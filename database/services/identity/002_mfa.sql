BEGIN;
CREATE TABLE IF NOT EXISTS user_mfa (
 user_id uuid PRIMARY KEY REFERENCES app_users(id), secret_cipher bytea NOT NULL,
 enabled boolean NOT NULL DEFAULT false, setup_expires_at timestamptz NOT NULL,
 last_step bigint NOT NULL DEFAULT -1, failures int NOT NULL DEFAULT 0, locked_until timestamptz
);
COMMIT;
