-- Logbook workflow migration
-- Adds paid/check-out related columns used by the new logbook card actions.

ALTER TABLE IF EXISTS public.check_in_logs
ADD COLUMN IF NOT EXISTS membership_label text DEFAULT 'REGULAR (NON-MEMBER)',
ADD COLUMN IF NOT EXISTS entry_fee numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_paid boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS paid_amount numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS paid_at timestamptz;

-- Keep legacy rows consistent.
UPDATE public.check_in_logs
SET
  membership_label = COALESCE(NULLIF(BTRIM(membership_label), ''), 'REGULAR (NON-MEMBER)'),
  entry_fee = COALESCE(entry_fee, 0),
  is_paid = COALESCE(is_paid, false),
  paid_amount = COALESCE(paid_amount, CASE WHEN COALESCE(is_paid, false) THEN COALESCE(entry_fee, 0) ELSE 0 END);

CREATE INDEX IF NOT EXISTS idx_check_in_logs_day_time
ON public.check_in_logs (time_in DESC);

CREATE INDEX IF NOT EXISTS idx_check_in_logs_paid
ON public.check_in_logs (is_paid, paid_at DESC);

