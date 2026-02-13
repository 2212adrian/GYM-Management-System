-- Revenue goal target table used by GoalCenterManager and wolfData goal sync

CREATE TABLE IF NOT EXISTS public.goal_target (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  period_type text NOT NULL CHECK (period_type IN ('DAILY', 'WEEKLY', 'MONTHLY')),
  target_amount numeric NOT NULL DEFAULT 0,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_goal_target_period_start
ON public.goal_target (period_type, start_date DESC);
