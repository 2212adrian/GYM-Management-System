-- Enforce one row per goal period (DAILY/WEEKLY/MONTHLY).
-- Run this once to clean existing duplicates and lock the schema.

-- 1) Keep the latest row per period and delete older duplicates.
WITH ranked AS (
  SELECT
    id,
    period_type,
    ROW_NUMBER() OVER (
      PARTITION BY period_type
      ORDER BY start_date DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM public.goal_target
)
DELETE FROM public.goal_target gt
USING ranked r
WHERE gt.id = r.id
  AND r.rn > 1;

-- 2) Ensure period is unique so app can upsert instead of inserting duplicates.
CREATE UNIQUE INDEX IF NOT EXISTS uq_goal_target_period_type
ON public.goal_target (period_type);

