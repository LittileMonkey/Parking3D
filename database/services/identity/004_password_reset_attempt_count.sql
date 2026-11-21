-- Upgrade older Identity databases to the current PasswordResetOtp EF model.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
ALTER TABLE public.password_reset_otps
    ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0;
COMMIT;
