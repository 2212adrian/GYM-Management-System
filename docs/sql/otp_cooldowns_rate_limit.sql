-- OTP anti-spam columns
-- Allows: 3 attempts, then 30-second cooldown (enforced by Netlify function logic)

ALTER TABLE IF EXISTS public.otp_cooldowns
ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS window_started_at timestamptz NOT NULL DEFAULT now(),
ADD COLUMN IF NOT EXISTS cooldown_until timestamptz;

-- Backfill old rows safely
UPDATE public.otp_cooldowns
SET window_started_at = COALESCE(last_sent_at, now())
WHERE window_started_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_otp_cooldowns_cooldown_until
ON public.otp_cooldowns (cooldown_until);
